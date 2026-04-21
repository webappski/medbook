import type { Handler } from '@netlify/functions';
import { supabase, jsonResponse, errorResponse, corsHeaders } from './lib/supabase';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  const { data, error } = await supabase
    .from('doctors')
    .select('specialty, specialty_label')
    .order('specialty_label', { ascending: true });

  if (error) {
    return errorResponse('Failed to fetch specialties', 'DATABASE_ERROR', 500);
  }

  // Deduplicate by specialty value
  const seen = new Set<string>();
  const specialties = (data || [])
    .filter(row => {
      if (seen.has(row.specialty)) return false;
      seen.add(row.specialty);
      return true;
    })
    .map(row => ({
      value: row.specialty,
      label: row.specialty_label,
    }));

  return jsonResponse({ specialties });
};
