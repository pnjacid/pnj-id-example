<?php
// ponytail: native single-file CAS client, zero composer dependencies
session_start();

$casServer = rtrim(getenv('CAS_SERVER') ?: 'https://id.pnj.ac.id/cas', '/');
$serviceUrl = getenv('SERVICE_URL') ?: 'http://localhost:8081';
$insecure = filter_var(getenv('CAS_INSECURE_SKIP_VERIFY') ?: 'false', FILTER_VALIDATE_BOOLEAN);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($path === '/logout' || isset($_GET['logout'])) {
    session_destroy();
    $logoutUrl = $casServer . '/logout?service=' . urlencode($serviceUrl);
    header('Location: ' . $logoutUrl, true, 302);
    echo '<a href="' . htmlspecialchars($logoutUrl, ENT_QUOTES, 'UTF-8') . '">Redirecting to logout...</a>';
    exit;
}

if (!empty($_SESSION['user'])) {
    echo '<h1>Hello ' . htmlspecialchars($_SESSION['user'], ENT_QUOTES, 'UTF-8') . '</h1>';
    echo '<a href="/logout">Logout</a>';
    exit;
}

$ticket = $_GET['ticket'] ?? null;
if (!$ticket) {
    $loginUrl = $casServer . '/login?service=' . urlencode($serviceUrl);
    header('Location: ' . $loginUrl, true, 302);
    echo '<a href="' . htmlspecialchars($loginUrl, ENT_QUOTES, 'UTF-8') . '">Redirecting to login...</a>';
    exit;
}

$validateUrl = $casServer . '/p3/serviceValidate?service=' . urlencode($serviceUrl) . '&ticket=' . urlencode($ticket);

$ch = curl_init($validateUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => !$insecure,
    CURLOPT_SSL_VERIFYHOST => $insecure ? 0 : 2,
]);
$body = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($err || $httpCode !== 200) {
    http_response_code(500);
    echo 'Error validating ticket: ' . htmlspecialchars($err ?: "HTTP $httpCode", ENT_QUOTES, 'UTF-8');
    exit;
}

if (str_contains($body, '<cas:authenticationSuccess>') &&
    preg_match('/<cas:user>(.*?)<\/cas:user>/s', $body, $matches)) {
    $_SESSION['user'] = trim($matches[1]);
    header('Location: /');
    exit;
}

http_response_code(401);
echo 'SSO FAILED ❌';
