import { splitCookiesString, parse as parseCookies } from 'set-cookie-parser';
import { kastlePayloadTemplate } from '../data/kastlePayloadTemplate';

const BASE_URL = 'https://www.mykastle.com';
const LOGIN_PAGE = `${BASE_URL}/mykastleweb/Login.aspx`;
const LOGIN_CLICK_ENDPOINT = `${LOGIN_PAGE}/LoginClick`;
const AUTH_ENDPOINT = `${BASE_URL}/mykastleweb/VisitorManagement/AddPreAuthorizedVisitors.aspx`;
const EASTERN_TIMEZONE = 'America/New_York';

interface HiddenInputs {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

interface KastleCredentials {
  username: string;
  password: string;
}

interface VisitorDetails {
  name: string;
  email: string;
  scheduledFor: string;
}

class CookieJar {
  private cookies = new Map<string, string>();

  storeFromHeader(headerValue: string | string[] | null) {
    if (!headerValue) return;
    const rawCookies = Array.isArray(headerValue)
      ? headerValue
      : splitCookiesString(headerValue);
    const cookies = rawCookies.flatMap((cookieString) =>
      splitCookiesString(cookieString),
    );
    cookies.forEach((cookieString) => {
      const parsed = parseCookies(cookieString);
      Object.entries(parsed).forEach(([key, value]) => {
        if (key !== 'maxAge') {
          this.cookies.set(key, String(value));
        }
      });
    });
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
}

function baseHeaders(overrides?: Record<string, string>) {
  return {
    'accept-language': 'en-US,en;q=0.9',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    ...overrides,
  };
}

function extractHiddenInputs(html: string): HiddenInputs {
  const getValue = (id: string) => {
    const match = html.match(new RegExp(`id="${id}" value="([^"]*)"`, 'i'));
    if (!match) {
      throw new Error(`Unable to locate hidden input ${id}`);
    }

    return match[1];
  };

  return {
    viewState: getValue('__VIEWSTATE'),
    viewStateGenerator: getValue('__VIEWSTATEGENERATOR'),
    eventValidation: getValue('__EVENTVALIDATION'),
  };
}

function formatSetDateTime(dateHeader: string | null) {
  const date = dateHeader ? new Date(dateHeader) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function toUsDateString(isoDate: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  return formatter.format(new Date(isoDate));
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: 'Visitor', lastName: 'Framework' };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  const lastName = parts.pop() as string;
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

function buildVisitorPayload(details: VisitorDetails) {
  const { firstName, lastName } = splitName(details.name);
  const startDate = toUsDateString(details.scheduledFor);

  const params = new URLSearchParams(kastlePayloadTemplate);

  params.set('ctl00$PC$txtVisitorStartDate', startDate);
  params.set('ctl00$PC$txtVisitorEndDate', startDate);
  params.set('ctl00$PC$txtVisitorEarliestTime', '08:00 AM');
  params.set('ctl00$PC$txtVisitorLatestTime', '06:00 PM');
  params.set('ctl00$PC$hdnFloorSelectedText', 'no floor control');
  params.set('ctl00$PC$txtVisitorsCompany', '');
  params.set('ctl00$PC$txtVisiting', '');
  params.set('ctl00$PC$txtVisitorsNotes', '');
  params.set('ctl00$PC$txtVisitorSplInstructions', '');
  params.set('ctl00$PC$txtVisitorEmailAddress', details.email);

  params.set('first_name_0', lastName);
  params.set('last_name_0', firstName);
  params.set('email_0', details.email);

  const jsonDetails = JSON.stringify([
    {
      lName: lastName,
      fName: firstName,
      email: details.email,
    },
  ]);
  params.set('ctl00$PC$hdnMultipleVisitorDetails', jsonDetails);

  return params.toString();
}

export async function authorizeKastleVisit(
  credentials: KastleCredentials,
  visitor: VisitorDetails,
) {
  const jar = new CookieJar();

  const loginPageResponse = await fetch(LOGIN_PAGE, {
    method: 'GET',
    headers: baseHeaders({
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-site': 'none',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    }),
  });

  jar.storeFromHeader(
    loginPageResponse.headers.get('set-cookie') ??
      (loginPageResponse.headers as unknown as {
        raw?: () => Record<string, string[]>;
        getSetCookie?: () => string[];
      }).getSetCookie?.(),
  );

  const loginHtml = await loginPageResponse.text();
  const hiddenInputs = extractHiddenInputs(loginHtml);
  const setDateTime = formatSetDateTime(loginPageResponse.headers.get('date'));

  const formParams = new URLSearchParams();
  formParams.set('__EVENTTARGET', '');
  formParams.set('__EVENTARGUMENT', '');
  formParams.set('__VIEWSTATE', hiddenInputs.viewState);
  formParams.set('__VIEWSTATEGENERATOR', hiddenInputs.viewStateGenerator);
  formParams.set('__VIEWSTATEENCRYPTED', '');
  formParams.set('__EVENTVALIDATION', hiddenInputs.eventValidation);
  formParams.set('hdnBruteForceCheck', 'true');
  formParams.set('ScriptManager1', '');
  formParams.set('txtUserName', credentials.username);
  formParams.set('chkPersistCookie', 'on');
  formParams.set('btnNext', 'Next');
  formParams.set('setDateTime', setDateTime);

  const preloginResponse = await fetch(LOGIN_PAGE, {
    method: 'POST',
    headers: baseHeaders({
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      origin: BASE_URL,
      referer: LOGIN_PAGE,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      cookie: jar.toHeader(),
    }),
    body: formParams.toString(),
  });

  jar.storeFromHeader(
    preloginResponse.headers.get('set-cookie') ??
      (preloginResponse.headers as unknown as {
        getSetCookie?: () => string[];
      }).getSetCookie?.(),
  );

  const loginResponse = await fetch(LOGIN_CLICK_ENDPOINT, {
    method: 'POST',
    headers: baseHeaders({
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json; charset=UTF-8',
      origin: BASE_URL,
      referer: LOGIN_PAGE,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'x-requested-with': 'XMLHttpRequest',
      cookie: jar.toHeader(),
    }),
    body: JSON.stringify({
      password: credentials.password,
      userName: credentials.username,
      isPersistentCookie: true,
    }),
  });

  jar.storeFromHeader(
    loginResponse.headers.get('set-cookie') ??
      (loginResponse.headers as unknown as {
        getSetCookie?: () => string[];
      }).getSetCookie?.(),
  );

  const authorizationBody = buildVisitorPayload(visitor);

  const authorizationResponse = await fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: baseHeaders({
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: BASE_URL,
      referer: AUTH_ENDPOINT,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'x-microsoftajax': 'Delta=true',
      'x-requested-with': 'XMLHttpRequest',
      cookie: jar.toHeader(),
    }),
    body: authorizationBody,
  });

  const responseText = await authorizationResponse.text();

  if (!authorizationResponse.ok) {
    throw new Error(
      `Kastle rejected visitor: HTTP ${authorizationResponse.status} ${authorizationResponse.statusText}`,
    );
  }

  if (!responseText.includes('PreAuthorizedVisitors.aspx')) {
    throw new Error('Kastle submission did not confirm success.');
  }

  return responseText;
}
