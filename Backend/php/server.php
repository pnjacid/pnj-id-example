<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/auth.php';

function jsonResponse(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];
if ($method === 'GET' && $path === '/health') {
    jsonResponse(200, ['status' => 'ok']);
}
if ($method !== 'GET' || $path !== '/api/profile') {
    jsonResponse(404, ['error' => 'Endpoint tidak ditemukan']);
}
if (!preg_match('/^Bearer ([^\s]+)$/', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $matches)) {
    jsonResponse(401, ['error' => 'Bearer token diperlukan']);
}
try {
    $claims = verifyAccessToken($matches[1]);
} catch (Throwable $error) {
    jsonResponse(401, ['error' => $error->getMessage()]);
}
jsonResponse(200, [
    'message' => 'Access token valid untuk test.read',
    'subject' => $claims['sub'] ?? null,
    'email' => $claims['email'] ?? $claims['mail'] ?? null,
    'scope' => $claims['scope'] ?? null,
]);
