/**
 * User-Agent + client hints qui matchent un vrai Chrome récent.
 * Doit être utilisé à la fois lors du login Playwright et lors des API calls HTTP
 * (DataDome bind le cookie aux signaux device).
 */
export const LBC_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

export function buildLbcApiHeaders(userAgent: string): Record<string, string> {
  return {
    'User-Agent': userAgent,
    Accept: '*/*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    Origin: 'https://www.leboncoin.fr',
    Referer: 'https://www.leboncoin.fr/',
    'sec-ch-ua':
      '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
  };
}
