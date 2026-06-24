<?php

namespace App\Jobs;

use App\Mail\DynamicMailable;
use App\Models\MailLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendMailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(private readonly MailLog $mailLog) {}

    public function handle(): void
    {
        $this->mailLog->update([
            'status' => 'sending',
            'attempts' => $this->mailLog->attempts + 1,
        ]);

        try {
            $sent = Mail::to($this->mailLog->to_email, $this->mailLog->to_name ?? '')
                ->send(new DynamicMailable($this->mailLog));

            $smtpDebug = $sent?->getSymfonySentMessage()?->getDebug();

            $this->mailLog->update([
                'status' => 'sent',
                'sent_at' => now(),
                'smtp_response' => $smtpDebug ?? 'Message accepted',
            ]);
        } catch (\Exception $e) {
            $this->mailLog->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        $this->mailLog->update([
            'status' => 'failed',
            'failed_at' => now(),
            'error_message' => $exception->getMessage(),
        ]);
    }
}
