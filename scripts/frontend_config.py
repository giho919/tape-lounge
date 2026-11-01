import re


def read_public_config(root):
    """Read the browser-safe Supabase and Turnstile constants from the live app bundle."""
    source = (root / 'lounge-app.js').read_text(encoding='utf-8')

    def value(name):
        match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(['\"])(.*?)\1", source)
        if not match:
            raise ValueError(f'Missing public frontend constant {name} in lounge-app.js')
        return match[2]

    return {
        'url': value('SUPA_URL'),
        'key': value('SUPA_KEY'),
        'turnstile': value('TURNSTILE_SITEKEY'),
    }
