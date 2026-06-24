<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WabLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'to_number',
        'message',
        'status',
        'provider_message_id',
        'error_message',
        'attempts',
        'is_test',
        'api_payload',
        'queued_at',
        'sent_at',
        'failed_at',
    ];

    protected $casts = [
        'is_test' => 'boolean',
        'api_payload' => 'array',
        'queued_at' => 'datetime',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];
}
