export async function sendPush(
  token: string,
  message: string,
  data: Record<string, string>,
  title = 'Donation reminder'
) {
  try {
    const { applicationDefault, getApps, initializeApp } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
    await getMessaging(app).send({
      token,
      notification: { title, body: message },
      data,
    });
  } catch (error) {
    console.warn('[Firebase] Push notification skipped or unavailable:', error);
  }
}
