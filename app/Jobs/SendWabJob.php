<?php

namespace App\Jobs;

use App\Models\WabLog;
use App\Services\WabClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWabJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(private readonly WabLog $wabLog) {}

    public function handle(WabClient $wab): void
    {
        $this->wabLog->update([
            'status' => 'sending',
            'attempts' => $this->wabLog->attempts + 1,
        ]);

        try {
            $response = $wab->send($this->wabLog->to_number, $this->wabLog->message);

            if ($response->successful()) {
                $this->wabLog->update([
                    'status' => 'sent',
                    'sent_at' => now(),
                    'provider_message_id' => $response->json('id'),
                ]);

                return;
            }

            $message = $response->json('message') ?? 'wab returned HTTP '.$response->status();

            // 400 = number not on WhatsApp: a permanent failure, no point retrying.
            if ($response->status() === 400) {
                $this->wabLog->update([
                    'status' => 'failed',
                    'failed_at' => now(),
                    'error_message' => $message,
                ]);

                return;
            }

            // 409 (not connected), 5xx, or connection errors: retry.
            throw new \RuntimeException($message);
        } catch (\Throwable $e) {
            $this->wabLog->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        $this->wabLog->update([
            'status' => 'failed',
            'failed_at' => now(),
            'error_message' => $exception->getMessage(),
        ]);
    }
}
