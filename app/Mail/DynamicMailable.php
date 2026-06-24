<?php

namespace App\Mail;

use App\Models\MailLog;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DynamicMailable extends Mailable
{
    use SerializesModels;

    public function __construct(private readonly MailLog $mailLog) {}

    public function envelope(): Envelope
    {
        $replyTo = $this->mailLog->reply_to_email
            ? [new Address($this->mailLog->reply_to_email, $this->mailLog->reply_to_name ?? '')]
            : [];

        $cc = collect($this->mailLog->cc ?? [])
            ->map(fn ($email) => new Address(is_array($email) ? $email['email'] : $email))
            ->all();

        $bcc = collect($this->mailLog->bcc ?? [])
            ->map(fn ($email) => new Address(is_array($email) ? $email['email'] : $email))
            ->all();

        return new Envelope(
            from: new Address($this->mailLog->from_email, $this->mailLog->from_name),
            to: [new Address($this->mailLog->to_email, $this->mailLog->to_name ?? '')],
            replyTo: $replyTo,
            cc: $cc,
            bcc: $bcc,
            subject: $this->mailLog->subject,
        );
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->mailLog->body_html);
    }
}
