# Higgsfield Resilience and Fallback Flow

This diagram documents the graceful-degradation path added to avoid 500s when the provider (Higgsfield) is down. Jobs are queued and bootstrapped later by the status poller.

```mermaid
sequenceDiagram
  participant UI as UI (VideoCreationDialog)
  participant GBV as Edge: generate-bot-video
  participant DB as Supabase DB (bot_videos)
  participant CVS as Edge: check-video-status
  participant H as Higgsfield API

  UI->>GBV: POST /generate-bot-video (communityId, videoType, prompt)
  alt H available
    GBV->>H: Create generation (POST)
    H-->>GBV: 200 {id}
    GBV->>DB: Insert bot_videos (status=processing, metadata.id)
    GBV-->>UI: 200 {status: processing, videoId}
  else H timeout/5xx
    GBV->>DB: Insert bot_videos (status=queued, metadata.provider_error)
    GBV-->>UI: 200 {status: queued, videoId}
  end

  loop Poll every 5s
    UI->>CVS: POST /check-video-status {videoId}
    CVS->>DB: Read bot_videos by id
    alt status completed/failed
      DB-->>CVS: Record
      CVS-->>UI: 200 {status, videoUrl, ...}
    else jobId missing AND status queued
      CVS->>H: Create generation (POST)
      alt H available
        H-->>CVS: 200 {id}
        CVS->>DB: Update (status=processing, metadata.id)
        CVS-->>UI: 200 {status: processing}
      else H timeout/5xx
        CVS-->>UI: 200 {status: queued}
      end
    else jobId present
      CVS->>H: Get status (GET)
      alt H 200
        H-->>CVS: {status, urls}
        CVS->>DB: Update (status, urls)
        CVS-->>UI: 200 {status, urls}
      else H 5xx/timeout
        CVS-->>UI: 200 {status: processing}
      end
    end
  end
```
