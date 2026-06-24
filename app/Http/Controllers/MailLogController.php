<?php

namespace App\Http\Controllers;

use App\Models\MailLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MailLogController extends Controller
{
    public function index(Request $request): Response
    {
        $logs = MailLog::query()
            ->when($request->input('search'), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('to_email', 'like', "%{$search}%")
                        ->orWhere('from_email', 'like', "%{$search}%")
                        ->orWhere('subject', 'like', "%{$search}%")
                        ->orWhere('uuid', 'like', "%{$search}%");
                });
            })
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('dashboard', [
            'logs' => $logs,
            'filters' => $request->only(['search', 'status']),
            'stats' => [
                'total' => MailLog::count(),
                'sent' => MailLog::where('status', 'sent')->count(),
                'failed' => MailLog::where('status', 'failed')->count(),
                'queued' => MailLog::whereIn('status', ['queued', 'sending'])->count(),
            ],
        ]);
    }
}
