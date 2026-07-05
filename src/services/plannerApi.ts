/**
 * Values Planner API — Sophy planner assists (web plannerAssistFetch parity).
 * Steps: 'seed' | 'vivid' | 'wantshould' | 'dedupe'.
 * LAW: planner flows are FREE tier — no gating in this layer.
 */
import auth from '@react-native-firebase/auth';

const PLANNER_ASSIST_URL = 'https://us-central1-inkwell-alpha.cloudfunctions.net/plannerAssist';

export async function plannerAssistFetch(step: string, payload: object): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error('Sign in required');
  const idToken = await user.getIdToken();
  const r = await fetch(PLANNER_ASSIST_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
    body: JSON.stringify(Object.assign({step}, payload)),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Sophy is unavailable right now.');
  return data.text;
}
