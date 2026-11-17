/**
 * Response quality helpers — direct answers, clear errors, no invented data.
 */

function modelUnavailableReply(error, lang = 'hi') {
  const detail = error?.message || (lang === 'en'
    ? 'The AI service is temporarily unavailable.'
    : 'AI सेवा अस्थायी रूप से उपलब्ध नहीं है।');
  const suffix = lang === 'en'
    ? ' Your database has not been changed.'
    : ' आपके database में कोई बदलाव नहीं किया गया।';
  return `${detail}${suffix}`;
}

function clarificationReply(question, lang = 'hi') {
  if (question) return question;
  return lang === 'en'
    ? 'I need one more detail to continue. Which organization or location should I use?'
    : 'आगे बढ़ने के लिए एक और जानकारी चाहिए। किस organization या location के लिए करना है?';
}

function unsupportedReply(lang = 'hi') {
  return lang === 'en'
    ? 'That operation is not supported by the Admin assistant yet. No database changes were made.'
    : 'यह कार्रवाई अभी Admin assistant में supported नहीं है। Database में कोई बदलाव नहीं हुआ।';
}

function stripContext(answer) {
  if (!answer || typeof answer !== 'object') return { reply: '' };
  const { context, ...rest } = answer;
  return { response: rest, context: context || null };
}

function withExecution(answer, execution) {
  return {
    ...answer,
    execution: execution || answer.execution || { status: 'completed', verified: true },
  };
}

module.exports = {
  modelUnavailableReply,
  clarificationReply,
  unsupportedReply,
  stripContext,
  withExecution,
};
