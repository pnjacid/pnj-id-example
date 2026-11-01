<?php
declare(strict_types=1);

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

function hasScope(array $claims, string $required): bool
{
    $scope = $claims['scope'] ?? '';
    $scopes = is_array($scope) ? $scope : explode(' ', is_string($scope) ? $scope : '');
    return in_array($required, $scopes, true);
}

function requestJson(string $url, ?string $body = null, array $headers = []): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($body !== null) {
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    }
    $data = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($data === false || $status < 200 || $status >= 300) {
        throw new RuntimeException("Request provider gagal ($status)");
    }
    $result = json_decode($data, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($result)) {
        throw new RuntimeException('Respons provider tidak valid');
    }
    return $result;
}

function verifyAccessToken(string $token, ?callable $fetch = null): array
{
    $fetch ??= 'requestJson';
    $issuer = getenv('OIDC_ISSUER') ?: 'https://dev-id.pnj.ac.id/cas/oidc';
    $clientId = getenv('OIDC_CLIENT_ID') ?: 'al-localhost5173testread-1012';
    if (substr_count($token, '.') === 2) {
        $jwks = $fetch("$issuer/jwks");
        // shortcut: JWKS diambil setiap request JWT; gunakan cache untuk traffic produksi.
        $jwks['keys'] = array_values(array_filter($jwks['keys'] ?? [], fn(array $key): bool =>
            ($key['kty'] ?? '') !== 'oct' && ($key['use'] ?? 'sig') === 'sig'
        ));
        $claims = (array) JWT::decode($token, JWK::parseKeySet($jwks, 'RS256'));
        if (($claims['iss'] ?? null) !== $issuer) {
            throw new RuntimeException('Issuer token tidak valid');
        }
    } else {
        $secret = getenv('OIDC_CLIENT_SECRET');
        if (!$secret) {
            throw new RuntimeException('OIDC_CLIENT_SECRET belum dikonfigurasi');
        }
        $claims = $fetch("$issuer/introspect", http_build_query(['token' => $token]), [
            'Authorization: Basic ' . base64_encode("$clientId:$secret"),
            'Content-Type: application/x-www-form-urlencoded',
        ]);
        if (($claims['active'] ?? false) !== true) {
            throw new RuntimeException('Token tidak aktif');
        }
        if (($claims['client_id'] ?? null) !== $clientId) {
            throw new RuntimeException('Token diterbitkan untuk client lain');
        }
    }
    if (!hasScope($claims, 'test.read')) {
        throw new RuntimeException('Token tidak memiliki scope test.read');
    }
    return $claims;
}
