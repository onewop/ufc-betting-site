"""Shared slowapi rate limiter instance — import this in any router that needs it."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
