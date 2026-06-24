<?php

namespace App\Http\Controllers;

use App\Jobs\SendWabJob;
use App\Models\WabLog;
use App\Services\WabClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class WabController extends Controller
{
    public function index(Request $request): Response
    {
        $logs = WabLog::query()
            ->when($request->input('search'), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('to_number', 'like', "%{$search}%")
                        ->orWhere('message', 'like', "%{$search}%")
                        ->orWhere('uuid', 'like', "%{$search}%");
                });
            })
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('wab/index', [
            'logs' => $logs,
            'filters' => $request->only(['search', 'status']),
            'stats' => [
                'total' => WabLog::count(),
                'sent' => WabLog::where('status', 'sent')->count(),
                'failed' => WabLog::where('status', 'failed')->count(),
                'queued' => WabLog::whereIn('status', ['queued', 'sending'])->count(),
            ],
            'testNumber' => config('services.wab.test_number'),
        ]);
    }

    public function status(WabClient $wab): JsonResponse
    {
        try {
            return response()->json($wab->status());
        } catch (\Throwable $e) {
            return response()->json(['state' => 'unreachable', 'error' => $e->getMessage()]);
        }
    }

    public function pair(Request $request, WabClient $wab): JsonResponse
    {
        $validated = $request->validate(['number' => 'required|string|max:20']);

        try {
            return response()->json($wab->requestPairing($validated['number']));
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function reconnect(WabClient $wab): JsonResponse
    {
        try {
            return response()->json($wab->reconnect());
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function logout(WabClient $wab): JsonResponse
    {
        try {
            return response()->json($wab->logout());
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function sendTest(): JsonResponse
    {
        $number = config('services.wab.test_number');

        if (! $number) {
            return response()->json(['success' => false, 'message' => 'No WAB_TEST_NUMBER configured.']);
        }

        $wabLog = WabLog::create([
            'uuid' => Str::uuid(),
            'to_number' => preg_replace('/\D/', '', $number),
            'message' => 'Test message from Notify — '.now()->toDateTimeString(),
            'status' => 'queued',
            'is_test' => true,
            'queued_at' => now(),
        ]);

        SendWabJob::dispatch($wabLog);

        return response()->json(['success' => true, 'message' => 'Test message queued.']);
    }
}
