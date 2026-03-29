export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateTaskInput(body: {
  task_id?: string;
  command?: string;
  callback_url?: string;
  working_dir?: string;
}): { valid: boolean; error?: string } {
  if (!body.task_id?.trim()) {
    return { valid: false, error: 'task_id is required' };
  }

  if (!body.command?.trim()) {
    return { valid: false, error: 'command is required' };
  }

  if (!body.callback_url?.trim()) {
    return { valid: false, error: 'callback_url is required' };
  }

  if (!isValidUrl(body.callback_url)) {
    return { valid: false, error: 'callback_url must be a valid HTTP/HTTPS URL' };
  }

  return { valid: true };
}
