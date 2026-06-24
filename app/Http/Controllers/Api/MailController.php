<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendMailJob;
use App\Models\MailLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MailController extends Controller
{
    public function sendmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_email' => 'required|email',
            'to_name' => 'nullable|string|max:255',
            'from_email' => 'required|email',
            'from_name' => 'required|string|max:255',
            'subject' => 'required|string|max:998',
            'body_html' => 'required|string',
            'body_text' => 'nullable|string',
            'reply_to_email' => 'nullable|email',
            'reply_to_name' => 'nullable|string|max:255',
            'cc' => 'nullable|array',
            'cc.*' => 'email',
            'bcc' => 'nullable|array',
            'bcc.*' => 'email',
            'headers' => 'nullable|array',
        ]);

        $mailLog = MailLog::create([
            'uuid' => Str::uuid(),
            ...$validated,
            'status' => 'queued',
            'api_payload' => $validated,
            'queued_at' => now(),
        ]);

        SendMailJob::dispatch($mailLog);

        return response()->json([
            'success' => true,
            'message' => 'Email queued successfully.',
            'data' => [
                'id' => $mailLog->uuid,
                'status' => $mailLog->status,
                'queued_at' => $mailLog->queued_at->toIso8601String(),
            ],
        ], 202);
    }
}
