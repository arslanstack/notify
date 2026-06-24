<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin client for the wab (WhatsApp Baileys) Node service.
 * Talks to it over localhost using the shared X-Internal-Secret header.
 */
class WabClient
{
    private string $url;

    private ?string $secret;

    public function __construct()
    {
        $this->url = rtrim((string) config('services.wab.url'), '/');
        $this->secret = config('services.wab.secret');
    }

    private function client(): PendingRequest
    {
        return Http::withHeaders(['X-Internal-Secret' => $this->secret])
            ->acceptJson()
            ->timeout(20);
    }

    /** @return array{state:string, phone:?string, since:?string, hasQr:bool} */
    public function status(): array
    {
        return $this->client()->get("{$this->url}/api/status")->throw()->json();
    }

    /** Returns the raw response so callers can inspect status codes (409/400). */
    public function send(string $to, string $message): Response
    {
        return $this->client()->post("{$this->url}/api/send", [
            'to' => $to,
            'message' => $message,
        ]);
    }

    public function requestPairing(string $number): array
    {
        return $this->client()->post("{$this->url}/api/pair", [
            'number' => $number,
        ])->throw()->json();
    }

    public function reconnect(): array
    {
        return $this->client()->post("{$this->url}/api/reconnect")->throw()->json();
    }

    public function logout(): array
    {
        return $this->client()->post("{$this->url}/api/logout")->throw()->json();
    }
}
