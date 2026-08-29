export function formValueExpression(selector, value) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`
}

export function fillFormValue(page, selector, value) {
  return page.evaluate(formValueExpression(selector, value))
}

export async function fillOnboardingHappyPath(
  page,
  fill = fillFormValue,
) {
  await fill(page, '#desiredJob', '프론트엔드 개발자')
  await fill(page, '#region', '서울 또는 원격')
  await fill(page, '#careerGapMonths', '8')
}
