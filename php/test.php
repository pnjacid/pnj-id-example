<?php
// Runnable self-check for CAS XML ticket response parsing

function parseCasUser(string $xml): ?string {
    if (str_contains($xml, '<cas:authenticationSuccess>') &&
        preg_match('/<cas:user>(.*?)<\/cas:user>/s', $xml, $m)) {
        return trim($m[1]);
    }
    return null;
}

$successXml = <<<XML
<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
    <cas:authenticationSuccess>
        <cas:user>199001012020121001</cas:user>
    </cas:authenticationSuccess>
</cas:serviceResponse>
XML;

$failureXml = <<<XML
<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
    <cas:authenticationFailure code="INVALID_TICKET">
        Ticket ST-123456 not recognized
    </cas:authenticationFailure>
</cas:serviceResponse>
XML;

assert(parseCasUser($successXml) === '199001012020121001', 'Should extract username on success');
assert(parseCasUser($failureXml) === null, 'Should return null on failure');
assert(parseCasUser('') === null, 'Should return null on empty body');

echo "All tests passed.\n";
