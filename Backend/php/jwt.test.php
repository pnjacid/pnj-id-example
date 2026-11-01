<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/auth.test.php';

use Firebase\JWT\JWT;

$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
if ($key === false || !openssl_pkey_export($key, $privateKey)) {
    throw new RuntimeException('Gagal membuat test key');
}
$publicKey = openssl_pkey_get_details($key);
$encode = fn(string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
$jwks = ['keys' => [[
    'kty' => 'RSA', 'kid' => 'test-key', 'alg' => 'RS256', 'use' => 'sig',
    'n' => $encode($publicKey['rsa']['n']), 'e' => $encode($publicKey['rsa']['e']),
]]];
$issuer = getenv('OIDC_ISSUER') ?: 'https://dev-id.pnj.ac.id/cas/oidc';
$valid = ['iss' => $issuer, 'sub' => 'test-subject', 'exp' => time() + 300, 'scope' => 'test.read'];
$fetch = function (string $url) use ($jwks): array {
    check(str_ends_with($url, '/jwks'));
    return $jwks;
};
foreach ([[], ['iss' => 'https://other.example'], ['exp' => time() - 60], ['nbf' => time() + 600], ['scope' => 'test.read.extra']] as $changes) {
    $token = JWT::encode(array_replace($valid, $changes), $privateKey, 'RS256', 'test-key');
    $rejected = false;
    try {
        verifyAccessToken($token, $fetch);
    } catch (Throwable $error) {
        $rejected = true;
    }
    check($rejected === ($changes !== []));
}
$token = JWT::encode($valid, $privateKey, 'RS256', 'test-key');
$parts = explode('.', $token);
$parts[2] = $encode(str_repeat('x', 256));
$rejected = false;
try {
    verifyAccessToken(implode('.', $parts), $fetch);
} catch (Throwable $error) {
    $rejected = true;
}
check($rejected);
echo "JWT signature, issuer, expiry, nbf, scope: PASS\n";
