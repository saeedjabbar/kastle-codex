import type { VisitorFormData } from '@/types';

const KASTLE_BASE_URL = 'https://www.mykastle.com/mykastleweb';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

interface CookieMap {
  [key: string]: string;
}

/**
 * Parses cookies from Set-Cookie headers
 */
function parseCookies(setCookieHeaders: string[]): CookieMap {
  const cookies: CookieMap = {};
  setCookieHeaders.forEach(header => {
    const [keyValue] = header.split(';');
    const [key, value] = keyValue.split('=');
    if (key && value) {
      cookies[key.trim()] = value.trim();
    }
  });
  return cookies;
}

/**
 * Merges cookies and formats them as a cookie string
 */
function mergeCookies(...cookieMaps: CookieMap[]): string {
  const merged: CookieMap = {};
  cookieMaps.forEach(map => {
    Object.assign(merged, map);
  });
  return Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

/**
 * Formats date from ISO string to mm/dd/yyyy
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Formats current date/time for Kastle login
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Step 1: Build session by getting login page
 */
async function buildSession(): Promise<CookieMap> {
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx`, {
    method: 'GET',
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9',
      'priority': 'u=0, i',
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': USER_AGENT
    }
  });

  const setCookieHeaders = response.headers.getSetCookie();
  return parseCookies(setCookieHeaders);
}

/**
 * Step 2: Prelogin - POST username
 */
async function prelogin(cookies: CookieMap, username: string): Promise<CookieMap> {
  const cookieString = mergeCookies(cookies);
  const now = new Date();
  
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx`, {
    method: 'POST',
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'max-age=0',
      'origin': 'https://www.mykastle.com',
      'priority': 'u=0, i',
      'referer': 'https://www.mykastle.com/mykastleweb/Login.aspx',
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': USER_AGENT,
      'cookie': cookieString,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      '__EVENTTARGET': '',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': 'OY1nQzW6YNHjoEpxVjbcAsyIS6T3FDqE6gp2NoNn335osPvUH9lLgodSw/jvXbGu32RaWkOX/BrIofVXFWJQtOTV81sNcjZgK1SThPIhg0ccpbcY8zykHvk5vrc+Obvn01qd+dVs0DG4hjzDTuYjo7arhnAI9cmce0QgdFWCq7AWI3lh64Wjilv80FxMVMApbvGzkeicqHlDcwifWPJ/pZame9FK1JEOx4QOt35T37Wb8u1NSDtP8u3jezhQdVxGN013tW/ugHhNpGfi80c49tA2/XN5XHhwQd/B8mexHx4E3Dv97PD78VVOoelWXeQAQqg/cQY5H9kFEEX8fZj2S2OiezNswM4EgYCHcG4ABzGOaKwOW4772QuRecJtXd1VJ9JKoIbA5uDlhF/89oXkuBvPdLufP2aPPk7hkBtZi8sj1gHcVsHjz60yV/HRHhTkvUMb+VrpxQOi+sIjdEPxlHOXCe638LEut6C0drfgngDZX9FCZ1qGco97d62NnvonPD9VSheknR3nJ3qT6z5ZESh34mZr3BGLgQE1vXH4LubBO7PuZAr+trVbMabIeZfqISsvmX2MrSq+B5jRXwSG6tmxZBwgzJNfSOaB5iYi5mxjToGe7s5tm55cHKxhAVs9mzfQrgAX/SKSRy1r9hOVp1YlV+vUqX/ReH1Pq/Jih+7XgPmCW8EA8TV2ER9rkdEek1IwnxD0Ft+5NNxOG2KYaeDhHcHO3ln6nbnvQZutjrxLs9tm9P1hfWt1oGyQho18CM8+CobIPS94v3KH5CMl9ueltXDAmATpiM6w92D5RruKbJxB+t31UgBxH4LlRB/8IdeDl33FbGGLcTZLW9EfqjknMS+kGexccWE7AW5+UFa7n9L8kE4ygTT9iPbRMyAIEC8GjnleSD9F2teImob5kwZzoLgs84TeckAjN61uNfuHDU4N',
      '__VIEWSTATEGENERATOR': 'C2EE9ABB',
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': 'zTzYjDrk8OGBm6XnBOKlWY4ELY4CN7g8nmmtbdn6/HztGEXms+FZZ0xG6SQvaCGqaewl6dzLb5q4lMLYuQkTkysXI+sk/p7RSUfagmqRcRRcXg/B8hp7jTKIX7mhrQ8H7YAlYy7VRwwAmFSo2NoVFeCuJ1RiflgXQGc0WkD3b+nmO1lg6DwcxTWBLkMN7UV2uRsCUrH16igSRy9BtKP1v7dLJzXpBlTUSktG17CSnCzId+PebfDJGGadZvsIlLeEeUtm+jPo0rewYz69E86AEfRi1KRMJQwYq8xsLOZkRNJsGOY/',
      'hdnBruteForceCheck': 'true',
      'ScriptManager1': '',
      'txtUserName': username,
      'chkPersistCookie': 'on',
      'btnNext': 'Next',
      'setDateTime': formatDateTime(now)
    })
  });

  const setCookieHeaders = response.headers.getSetCookie();
  const newCookies = parseCookies(setCookieHeaders);
  return { ...cookies, ...newCookies };
}

/**
 * Step 3: Login - POST password
 */
async function login(cookies: CookieMap, username: string, password: string): Promise<CookieMap> {
  const cookieString = mergeCookies(cookies);
  
  const response = await fetch(`${KASTLE_BASE_URL}/Login.aspx/LoginClick`, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://www.mykastle.com',
      'priority': 'u=1, i',
      'referer': 'https://www.mykastle.com/mykastleweb/Login.aspx',
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': USER_AGENT,
      'x-requested-with': 'XMLHttpRequest',
      'cookie': cookieString,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      password,
      userName: username,
      isPersistentCookie: true
    })
  });

  const setCookieHeaders = response.headers.getSetCookie();
  const newCookies = parseCookies(setCookieHeaders);
  return { ...cookies, ...newCookies };
}

/**
 * Generates form data payload for Kastle visitor creation
 */
function generateFormData(visitorData: {
  name: string;
  email: string;
  date: string;
}): string {
  // Parse name into first and last name
  const nameParts = visitorData.name.trim().split(' ');
  const lastname = nameParts.pop() || '';
  const firstname = nameParts.join(' ') || '';

  // Format date
  const formattedDate = formatDate(visitorData.date);

  // Template data string (URL-encoded)
  const templateData = 'ctl00%24ScriptManager1=ctl00%24PC%24updatePanelAddVisitorbtn%7Cctl00%24PC%24btnNewVisitorSave&_DTFORMAT=mm%2Fdd%2Fyyyy&_HAS2FACOMP=0&__EVENTTARGET=&__EVENTARGUMENT=&__VSTATE=7VZbc9tEFEaylIsd16GNTYEZW6EZxqKxs7o4tpMxnthOh1KSZpI0PMhuRpHWica6GF3aZGpeeIB3ZvgJzPDCP%2BAR%2Fgh%2FgXfg7MpJHJhQz9DHKvGujvY753zn7NFZ%2FcVk7jN8%2Fvi47bmh79nBPv4qsny85wVhSzcGT%2FDF8XGO4ZeM0EZoZa%2B9YpxhY3DinbefPs7wSalel2RFqlSlTI7N3zvSbcvUQ0ys4CDc8UzMMjm2nzFzHMvAyLIzmWwi%2FWyrpKhVWa0gVJJuSkmlqqK6VFcUxWR5qpiAcQXUwcPskRVYJzY%2BI2sgz1uui%2F2z0LH5uwdb29sd4fOtVmtr%2F2P3JBhumuAtxxZYbLJzmUxuLs8dLx%2B0WDY%2F1w6Ctq0HAZ8WTCvQwaL5heUO8sk97DtWEFiemxKtJ3oQ2rjc8Rzdcsttz3E8t3yNOLwY4lXhBmhVOMI%2BWWtIZUT%2BVoV2ZIeRjxsujkJft1eFvejEtgzI7KE3wG7DjWw7kU%2Ft6i%2BsU0jdMx%2B4mOx8hjDnUw85FqQkYV9IsGyB%2BwdjCkkUZohOiiaYudJMwLOFCc2FK81W6E4qpqcB3ZkGlJkGtAg8F%2FsTyGwQnUD8HevFbSrMNHbZaUCJaUDcNCB%2BGtDMNKDZaUDvkm1lzv61w3dpZaefum3bwm4IozHgHxyceS93vS3DwEGwAz%2F9FBfFTR9DKbpCX7cDvHm7Q7B6j1Ka%2Ff%2BGlt6UodxEkj6yXMMyIdod3QU7Dtwd6ie3vhjvTagKw8g3zvQAH0TDIWQs%2BC%2FFeajUGbrR1%2B8iaSl53qDdg3M9F5P9M3P3aYOCDSLVA4j0l%2FAy%2B47uDw7xecgnHWfNNNcu4Iorh80vbPu%2B549Twef3bAysBAgF%2BwJpokLxWkcclxJXSL4OmV8ad2HoQtvnQx%2FTXsX%2FxhWbja4pPi82N4rNZRgl1O3AhJpapVTvjSQNldSeSJ9JlZosiiO6Wr9EKZco5RJVrQBKLMbLklKp1ihA7o1VNXWdqEgiOOyuKXQuxVO3DHOMkoFYuUlpbcj1MiwihDSk9kbxM0l7jkrrvZEmq%2Bu1HggquNHAWx0Eeb0nIgQkKBT%2BuyYECTPQoPAYLcVwggb7v3%2Fzyzg6BIMqjxQNKYSqrElqlcQgV0AL1UWKJNcE1Ss%2FHfpUQ1IPXJJbGZJT61F8USuVu2vgjWSGJE6TZIARTxKkT46jRCR5jSsioF4BJMlwE0wS5yPq6pX69SVtcSxtEKlJIl0BTEMAvCCKzWLM7tIr7Ab4JagNahxQr9CqTPS75zLS9K3hXk9zdnriRCwjOd7kG1oSaInNFZMcpVDn8zcrOj6uXlub46NsiioupN5W7NuKfUMV%2B35mkZyRqePljh7qLS9yzdP8HXIPrTLCjyxsmzz7uBP3%2BHyarJCuHS9wu7qDzcUss%2FjIh7uXnj8QinUki0KWScokJ6hSr9WXHiaY0xzTN9kPaHvnaN9%2FQD5YQ88XdvRzy4kcoRP5tDU3pBqCsr8oBuSt%2BJAyLNzhUx0cGL41JJBCmpJaOB2fPYSC6wl92wN7RvzBnmUStVrt2ncxswg4bkESOvqF0MJ9z8dpSZ2UFDQpdTxh1wvJz%2BpfZDlGYiWVVRBbksAodwoX0CuRL8s%2B%2Fby8cRj%2B%2FO333%2B0rP1U%2FfeeH7J9%2FfNLq%2FfrjZ38D&__VIEWSTATE=&__VIEWSTATEENCRYPTED=&__PREVIOUSPAGE=lCrO3R7b5uQP48t9i4Z5Xuw_SV7aaPxZ2djvACz8PRbg40uWfSK1DRnz8zTg98OtSkQOl-1pOFygpi-fszfHICFfzW0f-Fn90TxC_3xQx37Z8v5lvN4-83Px66tFLsea8ou_tg2&ctl00%24ucHead%24hiddenIsManageBldgs=false&ctl00%24ucHead%24hdisSsoEnabled=&ctl00%24ucHead%24hdnOffsetDisplay=(UTC-05%3A00)%20Eastern%20Daylight%20Savings%20Time%20(US%20%26%20Canada)&ctl00%24ucHead%24hdnOffset=-4&ctl00%24ucHead%24hdnLogoutPromptSec=10&ctl00%24ucHead%24hdnLogoutSec=1170&ctl00%24hdnLastLogin=4jrltmasachbn5ddg01dqynz%2C507873104&ctl00%24PC%24hdnNameValues=&ctl00%24PC%24hdnMultipleVisitorDetails=%5B%7B%22lName%22%3A%22visitor%20last%20name%22%2C%22fName%22%3A%22visitor%20first%20name%22%2C%22email%22%3A%22mehrdad1mms%40gmail.com%22%7D%5D&ctl00%24PC%24txtVisitorStartDate=07%2F01%2F2025&ctl00%24PC%24txtSuggVisitorStartDate_ClientState=&ctl00%24PC%24txtVisitorEndDate=07%2F01%2F2025&ctl00%24PC%24txtSuggVisitorEndDate_ClientState=&ctl00%24PC%24txtVisitorEarliestTime=08%3A00%20AM&ctl00%24PC%24txtSuggVisitorEarliestTime_ClientState=&ctl00%24PC%24txtVisitorLatestTime=06%3A00%20PM&ctl00%24PC%24txtSuggVisitorLatestTime_ClientState=&ctl00%24PC%24hdnToday=mm%2Fdd%2Fyyyy&ctl00%24PC%24hdnCompVisitorAuthDetails=2000005989%40%24%3A%2C%3A%24%40480%40%24%3A%2C%3A%24%401080%40%24%3A%2C%3A%24%40180&ctl00%24PC%24hdnFloorsAssociatedToPrimCompany=&ctl00%24PC%24hdnFloorSelectedText=no%20floor%20control&ctl00%24PC%24hdnFloorSelectedValue=888&ctl00%24PC%24hdnPreviousPage=&ctl00%24PC%24ddlAddVisitorCompany=2000005989&ctl00%24PC%24lstBoxAddFloorsList=888&ctl00%24PC%24txtVisitorsCompany=CompanyName&ctl00%24PC%24txtVisiting=PersonName&ctl00%24PC%24txtVisitorsNotes=no%20notes&ctl00%24PC%24txtVisitorSplInstructions=No%20instructions&ctl00%24PC%24txtVisitorEmailAddress=saeed%40incl.us&ctl00%24PC%24ddlCOIExpiration=-1&ctl00%24PC%24txtCOIEmailList=&first_name_0=visitor%20last%20name&last_name_0=visitor%20first%20name&email_0=mehrdad1mms%40gmail.com&first_name_1=&last_name_1=&email_1=&first_name_2=&last_name_2=&email_2=&first_name_3=&last_name_3=&email_3=&first_name_4=&last_name_4=&email_4=&first_name_5=&last_name_5=&email_5=&first_name_6=&last_name_6=&email_6=&first_name_7=&last_name_7=&email_7=&first_name_8=&last_name_8=&email_8=&first_name_9=&last_name_9=&email_9=&ctl00%24PC%24hdnVendorSubComp=&fieldCount=10&__ASYNCPOST=true&ctl00%24PC%24btnNewVisitorSave=Save';

  // Parse the template data
  const parsed = new URLSearchParams(templateData);

  // Update dates and times
  parsed.set('ctl00$PC$txtVisitorStartDate', formattedDate);
  parsed.set('ctl00$PC$txtVisitorEndDate', formattedDate);
  parsed.set('ctl00$PC$txtVisitorEarliestTime', '08:00 AM');
  parsed.set('ctl00$PC$txtVisitorLatestTime', '06:00 PM');

  // Update floor text
  parsed.set('ctl00$PC$hdnFloorSelectedText', 'no floor control');

  // Update visitor details (note: first_name_0 is for last name, last_name_0 is for first name)
  parsed.set('first_name_0', lastname);
  parsed.set('last_name_0', firstname);
  parsed.set('email_0', visitorData.email);

  // Update email for notification
  parsed.set('ctl00$PC$txtVisitorEmailAddress', visitorData.email);

  // Update multiple visitor details JSON
  const multipleVisitorDetails = [{
    lName: lastname,
    fName: firstname,
    email: visitorData.email
  }];
  parsed.set('ctl00$PC$hdnMultipleVisitorDetails', JSON.stringify(multipleVisitorDetails));

  return parsed.toString();
}

/**
 * Step 4: Create visitor in Kastle
 */
async function createVisitor(cookieString: string, formData: string): Promise<Response> {
  return fetch(`${KASTLE_BASE_URL}/VisitorManagement/AddPreAuthorizedVisitors.aspx`, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'origin': 'https://www.mykastle.com',
      'priority': 'u=1, i',
      'referer': 'https://www.mykastle.com/mykastleweb/VisitorManagement/AddPreAuthorizedVisitors.aspx',
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': USER_AGENT,
      'x-microsoftajax': 'Delta=true',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': cookieString,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: formData
  });
}

/**
 * Main function: Authenticate and create visitor
 */
export async function authenticateAndCreateVisitor(visitorData: {
  name: string;
  email: string;
  date: string;
}): Promise<{ success: boolean; message?: string }> {
  const username = process.env.KASTLE_USERNAME!;
  const password = process.env.KASTLE_PASSWORD!;

  try {
    // Step 1: Build session
    let cookies = await buildSession();

    // Step 2: Prelogin
    cookies = await prelogin(cookies, username);

    // Step 3: Login
    cookies = await login(cookies, username, password);

    // Step 4: Generate form data
    const formData = generateFormData(visitorData);

    // Step 5: Create visitor
    const cookieString = mergeCookies(cookies);
    const response = await createVisitor(cookieString, formData);
    const responseText = await response.text();

    // Check if successful (response should contain "PreAuthorizedVisitors.aspx")
    if (responseText.includes('PreAuthorizedVisitors.aspx')) {
      return { success: true };
    } else {
      return { success: false, message: 'Failed to create visitor in Kastle' };
    }
  } catch (error) {
    console.error('Kastle authentication error:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

