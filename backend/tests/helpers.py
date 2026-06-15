"""
Shared test helpers — the test JWT keypair, token minting, and JWKS.

Lives here (not in conftest.py) so there is exactly ONE keypair instance:
pytest loads conftest.py as a plugin, so importing keys *from* conftest in test
modules would create a second module instance with a different key, and tokens
signed with one key wouldn't verify against the JWKS built from the other.
"""

import base64
import time

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt

from app.core.config import settings

TEST_KID = "test-key-1"

# Usernames that are platform-admins (mirrors the Keycloak realm role). Their
# minted tokens carry the platform-admin realm role unless roles are overridden.
PLATFORM_ADMINS = {"alice"}

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_private_pem = _private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode()


def _b64url_uint(n: int) -> str:
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_jwks() -> dict:
    nums = _private_key.public_key().public_numbers()
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": TEST_KID,
                "use": "sig",
                "alg": "RS256",
                "n": _b64url_uint(nums.n),
                "e": _b64url_uint(nums.e),
            }
        ]
    }


def make_token(
    sub: str,
    *,
    email: str | None = None,
    username: str | None = None,
    iss: str | None = None,
    aud: str | None = None,
    exp_offset: int = 300,
    roles: list[str] | None = None,
) -> str:
    """Mint a test JWT. Override iss/aud/exp to exercise AuthN failure cases.
    Platform-admin usernames get the realm role automatically."""
    now = int(time.time())
    if roles is None:
        roles = ["platform-admin"] if sub in PLATFORM_ADMINS else []
    return jwt.encode(
        {
            "sub": sub,
            "email": email or f"{sub}@test.io",
            "preferred_username": username or sub,
            "iss": iss or settings.keycloak_issuer,
            "aud": aud or settings.keycloak_client_id,
            "realm_access": {"roles": roles},
            "iat": now,
            "exp": now + exp_offset,
        },
        _private_pem,
        algorithm="RS256",
        headers={"kid": TEST_KID},
    )


def bearer(sub: str, **kw) -> dict:
    return {"Authorization": f"Bearer {make_token(sub, **kw)}"}
