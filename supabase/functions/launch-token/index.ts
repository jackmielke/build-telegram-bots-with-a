import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LONG_API_KEY = Deno.env.get('LONG_API_KEY');
    if (!LONG_API_KEY) {
      throw new Error('LONG_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's internal ID
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const {
      communityId,
      tokenName,
      tokenSymbol,
      tokenDescription,
      imageFile,
      templateId,
      chainId = 8453, // Base chain default
      userAddress,
      socialLinks = [],
      vestingRecipients = [],
      beneficiaries = []
    } = await req.json();

    if (!communityId || !tokenName || !tokenSymbol || !imageFile || !templateId || !userAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting token launch for:', tokenName);
    console.log('API Key present:', !!LONG_API_KEY);
    console.log('API Key length:', LONG_API_KEY?.length);

    // STEP 1: Upload image to IPFS
    console.log('Step 1: Uploading image to IPFS...');
    
    let imageHash: string;
    try {
      // Convert base64 data URL to raw base64 string if needed
      let base64Data: string;
      if (imageFile.startsWith('data:')) {
        base64Data = imageFile.split(',')[1];
      } else if (imageFile.startsWith('http')) {
        // If it's a URL, fetch it first
        const imgResponse = await fetch(imageFile);
        const imgBlob = await imgResponse.blob();
        const arrayBuffer = await imgBlob.arrayBuffer();
        base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      } else {
        base64Data = imageFile;
      }

      // Decode base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create File object (not just Blob) for better compatibility
      const file = new File([bytes], 'token-image.png', { type: 'image/png' });
      
      console.log('Image file created, size:', file.size, 'bytes');

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('image', file);

      console.log('Making request to Long.xyz API...');
      const imageResponse = await fetch('https://api.long.xyz/v1/ipfs/upload-image', {
        method: 'POST',
        headers: {
          'X-API-KEY': LONG_API_KEY,
          // Note: Don't set Content-Type, let fetch handle it automatically
        },
        body: formData,
      });

      console.log('Response status:', imageResponse.status);
      
      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error('Image upload failed:', errorText);
        console.error('Response headers:', Object.fromEntries(imageResponse.headers.entries()));
        
        if (imageResponse.status === 403) {
          throw new Error(`API Key Authentication Failed: Please verify your Long.xyz API key has upload permissions. Status: ${imageResponse.status}`);
        }
        
        throw new Error(`Failed to upload image (${imageResponse.status}): ${errorText}`);
      }

      console.log('Image upload successful');
      const imageResult = await imageResponse.json();
      console.log('Image response:', imageResult);
      
      if (!imageResult.result) {
        throw new Error('Invalid response from IPFS upload - missing result field');
      }

      imageHash = imageResult.result;

    } catch (uploadError) {
      console.error('Image upload error details:', uploadError);
      throw new Error(`Image upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    }
    
    console.log('Image uploaded successfully, hash:', imageHash);

    // STEP 2: Upload metadata to IPFS
    console.log('Step 2: Uploading metadata to IPFS...');
    const metadataResponse = await fetch('https://api.long.xyz/v1/ipfs/upload-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': LONG_API_KEY,
      },
      body: JSON.stringify({
        name: tokenName,
        description: tokenDescription || `${tokenName} token launched via BotBuilder`,
        image_hash: imageHash,
        social_links: socialLinks,
        vesting_recipients: vestingRecipients,
        fee_receiver: ''
      }),
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('Metadata upload failed:', errorText);
      throw new Error(`Failed to upload metadata: ${errorText}`);
    }

    const { result: metadataHash } = await metadataResponse.json();
    console.log('Metadata uploaded, hash:', metadataHash);

    // Compute beneficiaries to satisfy template requirements (65% preset + 35% beneficiaries = 100%)
    const WEI_100 = 1000000000000000000n; // 100%
    const TEMPLATE_BASE_SHARE = 650000000000000000n; // 65% preset by template
    const REQUIRED_BENEFICIARY_TOTAL = WEI_100 - TEMPLATE_BASE_SHARE; // 35%

    // Normalize/validate beneficiaries
    let finalBeneficiaries: Array<{ beneficiary: string; shares: string }> = Array.isArray(beneficiaries) ? beneficiaries : [];

    // If none provided, allocate 35% to the launching user by default
    if (!finalBeneficiaries.length) {
      finalBeneficiaries = [{ beneficiary: userAddress, shares: REQUIRED_BENEFICIARY_TOTAL.toString() }];
    } else {
      // Validate total equals the required 35%
      try {
        const total = finalBeneficiaries.reduce((acc, b) => acc + BigInt(b.shares), 0n);
        if (total !== REQUIRED_BENEFICIARY_TOTAL) {
          throw new Error(`Beneficiaries shares must total exactly ${REQUIRED_BENEFICIARY_TOTAL.toString()} (35%). Got ${total.toString()}.`);
        }
      } catch (e) {
        throw new Error(`Invalid beneficiaries format: ${(e as Error).message}`);
      }
    }

    // STEP 3: Encode auction template
    console.log('Step 3: Encoding auction template...');
    const encodeResponse = await fetch(`https://api.long.xyz/v1/auction-templates?chainId=${chainId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': LONG_API_KEY,
      },
      body: JSON.stringify({
        template_id: templateId,
        debug: true, // Enable debug to get token_address in response
        metadata: {
          token_name: tokenName,
          token_symbol: tokenSymbol,
          token_uri: `ipfs://${metadataHash}`,
          user_address: userAddress,
          beneficiaries: finalBeneficiaries
        }
      }),
    });

    if (!encodeResponse.ok) {
      const errorText = await encodeResponse.text();
      console.error('Template encoding failed:', errorText);
      throw new Error(`Failed to encode template: ${errorText}`);
    }

    const encodeData = await encodeResponse.json();
    const encodeResult = encodeData.result;
    console.log('Template encoded successfully');
    console.log('Encode result (full):', JSON.stringify(encodeData, null, 2));
    
    // Extract token address from encode response
    const tokenAddress = encodeResult?.token_address;
    const encodedPayload = encodeResult?.encoded_payload;
    
    console.log('Extracted token_address:', tokenAddress);
    console.log('Extracted encoded_payload length:', encodedPayload?.length);
    
    if (!tokenAddress || !encodedPayload) {
      console.error('Missing data in auction response. Result object:', encodeResult);
      throw new Error('Missing token_address or encoded_payload in response');
    }

    // STEP 4: Broadcast sponsored transaction
    console.log('Step 4: Broadcasting sponsored transaction...');
    const broadcastResponse = await fetch('https://api.long.xyz/v1/sponsorship', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': LONG_API_KEY,
      },
      body: JSON.stringify({
        encoded_payload: encodedPayload
      }),
    });

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      console.error('Broadcast failed:', errorText);
      throw new Error(`Failed to broadcast transaction: ${errorText}`);
    }

    const broadcastData = await broadcastResponse.json();
    const broadcastResult = broadcastData.result;
    const txHash = broadcastResult?.transaction_hash;
    
    if (!txHash) {
      console.error('Missing transaction hash in sponsorship response:', broadcastData);
      throw new Error('Missing transaction_hash in sponsorship response');
    }
    
    console.log('Transaction broadcasted, hash:', txHash);

    // STEP 5: Store token info in database
    console.log('Step 5: Storing token in database...');
    console.log('Token address (pre-computed):', tokenAddress);
    
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('bot_tokens')
      .insert({
        community_id: communityId,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        token_description: tokenDescription,
        token_address: tokenAddress,
        hook_address: encodeResult.hook_address || '',
        transaction_hash: txHash,
        image_ipfs_hash: imageHash,
        metadata_ipfs_hash: metadataHash,
        chain_id: chainId,
        template_id: templateId,
        initial_supply: encodeResult.params?.initial_supply || encodeResult.initial_supply,
        num_tokens_to_sell: encodeResult.params?.num_tokens_to_sell || encodeResult.num_tokens_to_sell,
        launch_metadata: {
          social_links: socialLinks,
          vesting_recipients: vestingRecipients,
          beneficiaries: finalBeneficiaries,
          user_address: userAddress,
          encode_result: encodeResult,
          broadcast_result: broadcastResult
        },
        created_by: userData.id
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Failed to store token:', tokenError);
      throw new Error(`Failed to store token: ${tokenError.message}`);
    }

    console.log('Token launch complete!');

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData,
        token_address: tokenAddress,
        transactionHash: txHash,
        explorerUrl: `https://basescan.org/tx/${txHash}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Token launch error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
