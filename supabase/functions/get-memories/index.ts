import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface Memory {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  community_id: string;
  created_by: string | null;
  metadata: any;
  creator_name?: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '')

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get community_id from request
    const { community_id } = await req.json()
    if (!community_id) {
      return new Response(
        JSON.stringify({ error: 'Missing community_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Fetching memories for user ${user.id} in community ${community_id}`)

    // First verify user is member of community - using service role to bypass RLS
    const { data: membership, error: membershipError } = await supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', community_id)
      .eq('user_id', await getUserIdFromAuth(user.id))
      .maybeSingle()

    if (membershipError) {
      console.error('Membership check error:', membershipError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify membership' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'User is not a member of this community' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch memories directly without RLS overhead
    const { data: memories, error: memoriesError } = await supabase
      .from('memories')
      .select('*')
      .eq('community_id', community_id)
      .order('created_at', { ascending: false })
      .limit(50) // Limit to reasonable number

    if (memoriesError) {
      console.error('Error fetching memories:', memoriesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch memories' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get creator names for memories that have created_by
    const creatorIds = memories?.filter(m => m.created_by).map(m => m.created_by) || []
    const uniqueCreatorIds = [...new Set(creatorIds)]
    
    let creatorNames: Record<string, string> = {}
    if (uniqueCreatorIds.length > 0) {
      const { data: creators, error: creatorsError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', uniqueCreatorIds)

      if (!creatorsError && creators) {
        creatorNames = creators.reduce((acc, user) => {
          acc[user.id] = user.name
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Enrich memories with creator names
    const enrichedMemories: Memory[] = (memories || []).map(memory => ({
      ...memory,
      creator_name: memory.created_by ? creatorNames[memory.created_by] || 'Unknown' : null
    }))

    console.log(`Successfully fetched ${enrichedMemories.length} memories`)

    return new Response(
      JSON.stringify({ memories: enrichedMemories }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function getUserIdFromAuth(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  
  if (error || !data) {
    console.error('Error getting user ID:', error)
    return null
  }
  
  return data.id
}