<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendWabJob;
use App\Models\WabLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WabController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => 'required|string|max:20',
            'message' => 'required|string',
        ]);

        $wabLog = WabLog::create([
            'uuid' => Str::uuid(),
            'to_number' => preg_replace('/\D/', '', $validated['to']),
            'message' => $validated['message'],
            'status' => 'queued',
            'api_payload' => $validated,
            'queued_at' => now(),
        ]);

        SendWabJob::dispatch($wabLog);

        return response()->json([
            'success' => true,
            'message' => 'WhatsApp message queued successfully.',
            'data' => [
                'id' => $wabLog->uuid,
                'status' => $wabLog->status,
                'queued_at' => $wabLog->queued_at->toIso8601String(),
            ],
        ], 202);
    }
}
