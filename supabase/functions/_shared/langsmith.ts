interface LangSmithTrace {
  name: string;
  run_type: 'llm' | 'chain' | 'tool';
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
  parent_run_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export async function trackLLMCall(
  name: string,
  inputs: any,
  apiKey: string | undefined,
  projectName: string = 'telegram-bot'
): Promise<string | null> {
  // Return null immediately if no API key
  if (!apiKey) {
    return null;
  }

  const runId = crypto.randomUUID();
  const startTime = Date.now();
  
  const trace: LangSmithTrace = {
    name,
    run_type: 'llm',
    inputs,
    tags: ['telegram-bot', 'lovable-ai'],
    metadata: {
      timestamp: new Date().toISOString(),
      environment: 'production'
    }
  };

  try {
    await fetch('https://api.smith.langchain.com/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        id: runId,
        project_name: projectName,
        ...trace,
        start_time: startTime
      })
    });
    
    return runId;
  } catch (error) {
    // Never fail the main operation - just log
    console.error('LangSmith tracking error (non-fatal):', error);
    return null;
  }
}

export async function completeLLMCall(
  runId: string | null,
  outputs: any,
  apiKey: string | undefined,
  error?: string
): Promise<void> {
  // Silently skip if no runId or API key
  if (!runId || !apiKey) {
    return;
  }

  try {
    await fetch(`https://api.smith.langchain.com/runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        outputs: error ? undefined : outputs,
        error,
        end_time: Date.now()
      })
    });
  } catch (err) {
    // Never fail the main operation
    console.error('LangSmith completion error (non-fatal):', err);
  }
}

export async function trackToolCall(
  toolName: string,
  args: any,
  result: any,
  apiKey: string | undefined,
  parentRunId: string | null,
  projectName: string = 'telegram-bot'
): Promise<void> {
  // Silently skip if no API key or parent run
  if (!apiKey || !parentRunId) {
    return;
  }

  const toolRunId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    await fetch('https://api.smith.langchain.com/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        id: toolRunId,
        parent_run_id: parentRunId,
        project_name: projectName,
        name: toolName,
        run_type: 'tool',
        inputs: args,
        outputs: { result },
        start_time: startTime,
        end_time: Date.now(),
        tags: ['tool', toolName]
      })
    });
  } catch (error) {
    // Never fail the main operation
    console.error('LangSmith tool tracking error (non-fatal):', error);
  }
}
