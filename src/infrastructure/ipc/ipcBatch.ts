/**
 * IPC Batch Manager
 * Batches multiple IPC calls to reduce overhead
 */

interface BatchRequest {
  channel: string;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class IPCBatchManager {
  private static instance: IPCBatchManager;
  private batchQueue: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batching window
  private readonly MAX_BATCH_SIZE = 10;

  private constructor() {}

  static getInstance(): IPCBatchManager {
    if (!IPCBatchManager.instance) {
      IPCBatchManager.instance = new IPCBatchManager();
    }
    return IPCBatchManager.instance;
  }

  /**
   * Queue an IPC call for batching
   */
  async queue<T>(channel: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.batchQueue.push({
        channel,
        args,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // If batch is full, process immediately
      if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
        this.processBatch();
        return;
      }

      // Otherwise, set timeout to process batch
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, this.BATCH_DELAY);
      }
    });
  }

  /**
   * Process queued batch
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    // Process each request individually (Electron IPC doesn't support true batching)
    // But we can optimize by grouping similar requests
    const grouped = this.groupByChannel(batch);

    for (const [_channel, requests] of Object.entries(grouped)) {
      // Process requests for this channel
      for (const request of requests) {
        try {
          const electron = (window as any).electron;
          if (!electron?.ipc) {
            request.reject(new Error('IPC not available'));
            continue;
          }

          const result = await electron.ipc.invoke(request.channel, ...request.args);
          request.resolve(result);
        } catch (error) {
          request.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  /**
   * Group requests by channel
   */
  private groupByChannel(requests: BatchRequest[]): Record<string, BatchRequest[]> {
    const grouped: Record<string, BatchRequest[]> = {};
    for (const request of requests) {
      if (!grouped[request.channel]) {
        grouped[request.channel] = [];
      }
      grouped[request.channel].push(request);
    }
    return grouped;
  }

  /**
   * Flush pending batch immediately
   */
  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.processBatch();
  }
}

export const ipcBatchManager = IPCBatchManager.getInstance();
