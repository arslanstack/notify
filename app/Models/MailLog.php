<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MailLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'to_email',
        'to_name',
        'from_email',
        'from_name',
        'subject',
        'body_html',
        'body_text',
        'reply_to_email',
        'reply_to_name',
        'cc',
        'bcc',
        'headers',
        'status',
        'smtp_response',
        'error_message',
        'attempts',
        'api_payload',
        'queued_at',
        'sent_at',
        'failed_at',
    ];

    protected $casts = [
        'cc' => 'array',
        'bcc' => 'array',
        'headers' => 'array',
        'api_payload' => 'array',
        'queued_at' => 'datetime',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];
}
