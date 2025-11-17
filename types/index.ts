export interface CalendlyWebhookPayload {
  event: string;
  created_at: string;
  payload: {
    name: string;
    email: string;
    scheduled_event: {
      name: string;
      start_time: string;
      end_time: string;
      location?: {
        location: string;
        type: string;
      };
    };
  };
}

export interface KastleVisitor {
  id: string;
  name: string;
  email: string;
  date: string;
  event_name?: string;
  status: 'pending' | 'approved' | 'failed';
  created_at: string;
}

export interface VisitorFormData {
  start_date: string; // mm/dd/yyyy
  end_date: string; // mm/dd/yyyy
  daily_earliest_time: string; // hh:mm AM/PM
  daily_latest_time: string; // hh:mm AM/PM
  company: string;
  floor: string;
  visitors_company: string;
  person_visiting: string;
  notes_on_visit: string;
  special_instructions: string;
  email_to_be_notified_when_visitor_arrives: string;
  'last_name/vendor_company_name': string;
  first_name: string;
  visitor_email_for_notification: string;
}

