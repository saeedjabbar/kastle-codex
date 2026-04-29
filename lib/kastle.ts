const KASTLE_BASE_URL = 'https://www.mykastle.com/mykastleweb';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

interface CookieMap {
  [key: string]: string;
}

function parseCookies(setCookieHeaders: string[]): CookieMap {
  const cookies: CookieMap = {};
  setCookieHeaders.forEach((header) => {
    const [keyValue] = header.split(';');
    const [key, value] = keyValue.split('=');
    if (key && value) cookies[key.trim()] = value.trim();
  });
  return cookies;
}

function mergeCookies(...cookieMaps: CookieMap[]): string {
  const merged: CookieMap = {};
  cookieMaps.forEach((m) => Object.assign(merged, m));
  return Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

function extractHidden(html: string, name: string): string | null {
  const m =
    html.match(new RegExp(`name="${name}"[^>]+value="([^"]*)"`)) ||
    html.match(new RegExp(`value="([^"]*)"[^>]+name="${name}"`));
  return m ? m[1] : null;
}

async function buildSession(): Promise<{ cookies: CookieMap; viewState: string; viewStateGenerator: string; eventValidation: string }> {
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx`, {
    method: 'GET',
    headers: { 'user-agent': USER_AGENT },
  });
  const html = await response.text();
  const viewState = extractHidden(html, '__VIEWSTATE') || '';
  const viewStateGenerator = extractHidden(html, '__VIEWSTATEGENERATOR') || '';
  const eventValidation = extractHidden(html, '__EVENTVALIDATION') || '';
  if (!viewState || !eventValidation) {
    throw new Error('Failed to extract login page tokens');
  }
  return {
    cookies: parseCookies(response.headers.getSetCookie()),
    viewState,
    viewStateGenerator,
    eventValidation,
  };
}

async function prelogin(
  cookies: CookieMap,
  username: string,
  tokens: { viewState: string; viewStateGenerator: string; eventValidation: string }
): Promise<CookieMap> {
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx`, {
    method: 'POST',
    headers: {
      'user-agent': USER_AGENT,
      'cookie': mergeCookies(cookies),
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://www.mykastle.com',
      'referer': `${KASTLE_BASE_URL}/Login.aspx`,
    },
    body: new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: tokens.viewState,
      __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
      __VIEWSTATEENCRYPTED: '',
      __EVENTVALIDATION: tokens.eventValidation,
      hdnBruteForceCheck: 'true',
      ScriptManager1: '',
      txtUserName: username,
      chkPersistCookie: 'on',
      btnNext: 'Next',
      setDateTime: formatDateTime(new Date()),
    }),
  });
  const newCookies = parseCookies(response.headers.getSetCookie());
  return { ...cookies, ...newCookies };
}

async function login(cookies: CookieMap, username: string, password: string): Promise<CookieMap> {
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx/LoginClick`, {
    method: 'POST',
    headers: {
      'user-agent': USER_AGENT,
      'cookie': mergeCookies(cookies),
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      'origin': 'https://www.mykastle.com',
      'referer': `${KASTLE_BASE_URL}/Login.aspx`,
    },
    body: JSON.stringify({ password, userName: username, isPersistentCookie: true }),
  });
  const text = await response.text();
  let parsed: { ErrorMessage?: string; Message?: string; IsLocked?: boolean } = {};
  try {
    const outer = JSON.parse(text) as { d: string };
    parsed = JSON.parse(outer.d);
  } catch {
    // ignore parse errors; fall through
  }
  if (parsed.ErrorMessage || parsed.IsLocked) {
    throw new Error(`Kastle login rejected: ${parsed.ErrorMessage || 'account locked'}`);
  }
  const newCookies = parseCookies(response.headers.getSetCookie());
  return { ...cookies, ...newCookies };
}

async function loadVisitorPage(cookies: CookieMap): Promise<{ vstate: string; previousPage: string; viewState: string; eventValidation: string }> {
  const response = await fetch(`${KASTLE_BASE_URL}/VisitorManagement/AddPreAuthorizedVisitors.aspx`, {
    method: 'GET',
    headers: { 'user-agent': USER_AGENT, 'cookie': mergeCookies(cookies) },
  });
  if (!response.ok) {
    throw new Error(`Failed to load visitor page: ${response.status}`);
  }
  const html = await response.text();
  const vstate = extractHidden(html, '__VSTATE');
  const previousPage = extractHidden(html, '__PREVIOUSPAGE');
  const viewState = extractHidden(html, '__VIEWSTATE') || '';
  const eventValidation = extractHidden(html, '__EVENTVALIDATION') || '';
  if (!vstate || !previousPage) {
    throw new Error('Visitor page missing required tokens (session may be invalid)');
  }
  return { vstate, previousPage, viewState, eventValidation };
}

function buildVisitorFormData(
  visitor: { name: string; email: string; date: string },
  tokens: { vstate: string; previousPage: string; viewState: string; eventValidation: string }
): string {
  const nameParts = visitor.name.trim().split(' ');
  const lastname = nameParts.pop() || '';
  const firstname = nameParts.join(' ') || '';
  const formattedDate = formatDate(visitor.date);

  const body = new URLSearchParams();
  body.set('ctl00$ScriptManager1', 'ctl00$PC$updatePanelAddVisitorbtn|ctl00$PC$btnNewVisitorSave');
  body.set('_DTFORMAT', 'mm/dd/yyyy');
  body.set('_HAS2FACOMP', '0');
  body.set('__EVENTTARGET', '');
  body.set('__EVENTARGUMENT', '');
  body.set('__VSTATE', tokens.vstate);
  body.set('__VIEWSTATE', tokens.viewState);
  body.set('__VIEWSTATEENCRYPTED', '');
  body.set('__PREVIOUSPAGE', tokens.previousPage);
  if (tokens.eventValidation) body.set('__EVENTVALIDATION', tokens.eventValidation);
  body.set('ctl00$ucHead$hiddenIsManageBldgs', 'false');
  body.set('ctl00$ucHead$hdnOffsetDisplay', '(UTC-05:00) Eastern Daylight Savings Time (US & Canada)');
  body.set('ctl00$ucHead$hdnOffset', '-4');
  body.set('ctl00$ucHead$hdnLogoutPromptSec', '10');
  body.set('ctl00$ucHead$hdnLogoutSec', '1170');
  body.set('ctl00$PC$txtVisitorStartDate', formattedDate);
  body.set('ctl00$PC$txtVisitorEndDate', formattedDate);
  body.set('ctl00$PC$txtVisitorEarliestTime', '08:00 AM');
  body.set('ctl00$PC$txtVisitorLatestTime', '06:00 PM');
  body.set('ctl00$PC$hdnToday', 'mm/dd/yyyy');
  body.set('ctl00$PC$hdnCompVisitorAuthDetails', '2000005989@$:,:$@480@$:,:$@1080@$:,:$@180');
  body.set('ctl00$PC$hdnFloorsAssociatedToPrimCompany', '');
  body.set('ctl00$PC$hdnFloorSelectedText', 'no floor control');
  body.set('ctl00$PC$hdnFloorSelectedValue', '888');
  body.set('ctl00$PC$hdnPreviousPage', '');
  body.set('ctl00$PC$ddlAddVisitorCompany', '2000005989');
  body.set('ctl00$PC$lstBoxAddFloorsList', '888');
  body.set('ctl00$PC$txtVisitorsCompany', 'CompanyName');
  body.set('ctl00$PC$txtVisiting', 'PersonName');
  body.set('ctl00$PC$txtVisitorsNotes', 'no notes');
  body.set('ctl00$PC$txtVisitorSplInstructions', 'No instructions');
  body.set('ctl00$PC$txtVisitorEmailAddress', visitor.email);
  body.set('ctl00$PC$ddlCOIExpiration', '-1');
  body.set('ctl00$PC$txtCOIEmailList', '');
  body.set('first_name_0', lastname);
  body.set('last_name_0', firstname);
  body.set('email_0', visitor.email);
  for (let i = 1; i < 10; i++) {
    body.set(`first_name_${i}`, '');
    body.set(`last_name_${i}`, '');
    body.set(`email_${i}`, '');
  }
  body.set('ctl00$PC$hdnMultipleVisitorDetails', JSON.stringify([{ lName: lastname, fName: firstname, email: visitor.email }]));
  body.set('ctl00$PC$hdnNameValues', '');
  body.set('ctl00$PC$hdnVendorSubComp', '');
  body.set('fieldCount', '10');
  body.set('__ASYNCPOST', 'true');
  body.set('ctl00$PC$btnNewVisitorSave', 'Save');

  return body.toString();
}

async function createVisitor(cookies: CookieMap, formData: string): Promise<string> {
  const response = await fetch(`${KASTLE_BASE_URL}/VisitorManagement/AddPreAuthorizedVisitors.aspx`, {
    method: 'POST',
    headers: {
      'user-agent': USER_AGENT,
      'cookie': mergeCookies(cookies),
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'origin': 'https://www.mykastle.com',
      'referer': `${KASTLE_BASE_URL}/VisitorManagement/AddPreAuthorizedVisitors.aspx`,
      'x-microsoftajax': 'Delta=true',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: formData,
  });
  return response.text();
}

export async function authenticateAndCreateVisitor(visitorData: {
  name: string;
  email: string;
  date: string;
}): Promise<{ success: boolean; message?: string }> {
  const username = process.env.KASTLE_USERNAME;
  const password = process.env.KASTLE_PASSWORD;

  if (!username || !password) {
    return { success: false, message: 'Kastle credentials not configured' };
  }

  try {
    const session = await buildSession();
    let cookies = await prelogin(session.cookies, username, session);
    cookies = await login(cookies, username, password);

    const visitorTokens = await loadVisitorPage(cookies);
    const formData = buildVisitorFormData(visitorData, visitorTokens);
    const responseText = await createVisitor(cookies, formData);

    if (responseText.includes('PreAuthorizedVisitors.aspx') || responseText.includes('pageRedirect')) {
      return { success: true };
    }
    console.error('Kastle visitor creation unexpected response:', responseText.substring(0, 500));
    return { success: false, message: 'Unexpected response from Kastle' };
  } catch (error) {
    console.error('Kastle authentication error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
