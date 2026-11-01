<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';

function check(bool $condition): void
{
    if (!$condition) {
        throw new RuntimeException('Test gagal');
    }
}

foreach (['openid test.read', ['openid', 'test.read']] as $scope) {
    check(hasScope(['scope' => $scope], 'test.read'));
}
foreach ([null, '', 'test.read.extra', ['test.read.extra']] as $scope) {
    check(!hasScope(['scope' => $scope], 'test.read'));
}
$original = getenv('OIDC_CLIENT_SECRET');
putenv('OIDC_CLIENT_SECRET=test-secret');
try {
    $valid = ['active' => true, 'client_id' => getenv('OIDC_CLIENT_ID') ?: 'al-localhost5173testread-1012', 'scope' => 'test.read', 'sub' => 'test-subject'];
    foreach ([[], ['active' => false], ['client_id' => 'other'], ['scope' => 'test.read.extra']] as $changes) {
        $fetch = function (string $url, string $body, array $headers) use ($valid, $changes): array {
            check(str_ends_with($url, '/introspect'));
            check($body === 'token=opaque-token');
            check(str_starts_with($headers[0], 'Authorization: Basic '));
            return array_replace($valid, $changes);
        };
        $rejected = false;
        try {
            $claims = verifyAccessToken('opaque-token', $fetch);
        } catch (RuntimeException $error) {
            $rejected = true;
        }
        check($rejected === ($changes !== []));
        if (!$rejected) {
            check($claims === $valid);
        }
    }
} finally {
    putenv($original === false ? 'OIDC_CLIENT_SECRET' : "OIDC_CLIENT_SECRET=$original");
}
echo "Scope dan introspection: PASS\n";
