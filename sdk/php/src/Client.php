<?php

declare(strict_types=1);

namespace RenderKit;

/**
 * Minimal, dependency-free client for the RenderKit API.
 *
 *   $rk = new \RenderKit\Client(getenv('RENDERKIT_KEY'));
 *   $pdf = $rk->pdf(['html' => $html, 'format' => 'A4']);
 *   $png = $rk->screenshot(['url' => 'https://example.com', 'full_page' => true]);
 */
final class Client
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://api.renderkit.example',
        private readonly int $timeoutSeconds = 60,
    ) {
    }

    /** @param array<string,mixed> $options See https://…/docs for every option. Returns PDF bytes. */
    public function pdf(array $options): string
    {
        return $this->request('pdf', $options);
    }

    /** @param array<string,mixed> $options Returns image bytes (png by default). */
    public function screenshot(array $options): string
    {
        return $this->request('screenshot', $options);
    }

    /** @return array{plan:string,used:int,limit:int,period:string} */
    public function usage(): array
    {
        $raw = $this->request('usage', null, 'GET');
        return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }

    /** Convenience: render and send to the browser, then exit. */
    public function stream(string $bytes, string $filename, bool $download = false): never
    {
        $type = match (strtolower(pathinfo($filename, PATHINFO_EXTENSION))) {
            'pdf' => 'application/pdf', 'png' => 'image/png', 'jpg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', default => 'application/octet-stream',
        };
        header('Content-Type: ' . $type);
        header('Content-Length: ' . strlen($bytes));
        header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . addslashes($filename) . '"');
        echo $bytes;
        exit;
    }

    private function request(string $endpoint, ?array $body, string $method = 'POST'): string
    {
        $ch = curl_init(rtrim($this->baseUrl, '/') . '/v1/' . $endpoint);
        $headers = ['Authorization: Bearer ' . $this->apiKey, 'Accept: */*'];
        if ($method === 'POST') {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $response = curl_exec($ch);
        if ($response === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new RenderKitException('Network error: ' . $err, 0, 'network');
        }
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($status !== 200) {
            $decoded = json_decode($response, true);
            $message = $decoded['error']['message'] ?? ('HTTP ' . $status);
            $code = $decoded['error']['code'] ?? 'error';
            throw new RenderKitException($message, $status, $code);
        }
        return $response;
    }
}
