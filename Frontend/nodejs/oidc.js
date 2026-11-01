import * as oidc from 'openid-client';

export function pnjClientSecretBasic(secret) {
  return (_metadata, client, _body, headers) => {
    // PNJ ID compatibility: preserve the raw Basic credentials used by the original client.
    headers.set('authorization', `Basic ${Buffer.from(`${client.client_id}:${secret}`).toString('base64')}`);
  };
}

export async function loadProvider(issuer, clientId, secret) {
  if (!secret) throw new Error('OIDC_CLIENT_SECRET belum dikonfigurasi');
  const config = await oidc.discovery(new URL(issuer), clientId, secret, pnjClientSecretBasic(secret), {
    algorithm: 'oidc',
    execute: [oidc.enableNonRepudiationChecks]
  });
  return config;
}

export async function completeLogin(config, url, transaction) {
  let stage = 'callback.token-validation';
  try {
    const tokens = await oidc.authorizationCodeGrant(config, url, {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.codeVerifier,
      idTokenExpected: true
    });
    const claims = tokens.claims();
    stage = 'callback.userinfo';
    const user = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
    return { user, accessToken: tokens.access_token, idToken: tokens.id_token, expiresIn: tokens.expiresIn() };
  } catch (error) {
    error.stage = stage;
    throw error;
  }
}

export { oidc };
