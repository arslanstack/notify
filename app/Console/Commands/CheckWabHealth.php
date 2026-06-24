<?php

namespace App\Console\Commands;

use App\Jobs\SendWabJob;
use App\Models\WabLog;
use App\Services\WabClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CheckWabHealth extends Command
{
    protected $signature = 'wab:health-check';

    protected $description = 'Weekly wab session health check: alert if logged out, keep-warm if idle.';

    public function handle(WabClient $wab): int
    {
        try {
            $state = $wab->status()['state'] ?? 'unreachable';
        } catch (\Throwable $e) {
            $state = 'unreachable';
        }

        $this->info("wab state: {$state}");

        // Needs attention → email the alert address.
        if (in_array($state, ['logged_out', 'unreachable'], true)) {
            $email = config('services.wab.alert_email');

            if ($email) {
                Mail::raw(
                    "The WhatsApp (wab) session is '{$state}' and needs attention.\n\n".
                    'Re-link it from the dashboard: '.config('app.url').'/wab',
                    fn ($m) => $m->to($email)->subject('⚠️ WhatsApp (wab) session needs attention')
                );
                $this->warn("State '{$state}' — alert email sent to {$email}.");
            }

            return self::SUCCESS;
        }

        // Connected → keep the session warm if nothing has been sent in 7 days.
        if ($state === 'open') {
            $lastSent = WabLog::where('status', 'sent')->latest('sent_at')->value('sent_at');

            if (! $lastSent || $lastSent->lt(now()->subDays(7))) {
                $number = config('services.wab.test_number');

                if ($number) {
                    $wabLog = WabLog::create([
                        'uuid' => Str::uuid(),
                        'to_number' => preg_replace('/\D/', '', $number),
                        'message' => 'Keep-warm health check — '.now()->toDateTimeString(),
                        'status' => 'queued',
                        'is_test' => true,
                        'queued_at' => now(),
                    ]);

                    SendWabJob::dispatch($wabLog);
                    $this->info('No activity in 7 days — keep-warm test message queued.');
                }
            } else {
                $this->info('Recent activity present — no keep-warm needed.');
            }
        }

        return self::SUCCESS;
    }
}
