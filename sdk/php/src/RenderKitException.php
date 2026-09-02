<?php

declare(strict_types=1);

namespace RenderKit;

final class RenderKitException extends \RuntimeException
{
    public function __construct(string $message, private readonly int $status, private readonly string $errorCode)
    {
        parent::__construct($message, $status);
    }

    public function getStatus(): int { return $this->status; }
    public function getErrorCode(): string { return $this->errorCode; }
    public function isQuotaExceeded(): bool { return $this->errorCode === 'quota_exceeded'; }
    public function isRateLimited(): bool { return $this->errorCode === 'rate_limited'; }
}
