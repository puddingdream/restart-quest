import { h } from "../../../shared/dom";
import { failureReasonLabels, type FailureReason } from "../types";

type FailureReasonFormProps = {
  onSubmit: (reason: FailureReason, note: string) => void;
  onCancel: () => void;
};

const failureReasons = Object.keys(failureReasonLabels) as FailureReason[];

export function renderFailureReasonForm(props: FailureReasonFormProps): HTMLElement {
  const select = h(
    "select",
    { attrs: { name: "failureReason", required: true } },
    ...failureReasons.map((reason) =>
      h("option", { attrs: { value: reason }, text: failureReasonLabels[reason] }),
    ),
  );
  const note = h("textarea", {
    attrs: {
      name: "note",
      rows: 3,
      placeholder: "짧은 메모를 남기면 재설계 이유로만 사용합니다.",
    },
  });

  const form = h(
    "form",
    { className: "failure-form" },
    h("label", { className: "field compact" }, h("span", { text: "막힌 이유" }), select),
    h("label", { className: "field compact" }, h("span", { text: "메모 선택" }), note),
    h(
      "div",
      { className: "action-row" },
      h(
        "button",
        { className: "button button-primary", attrs: { type: "submit" } },
        "더 작게 다시 나누기",
      ),
      h(
        "button",
        {
          className: "button button-ghost",
          attrs: { type: "button" },
          onClick: props.onCancel,
        },
        "취소",
      ),
    ),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    props.onSubmit(select.value as FailureReason, note.value);
  });

  return form;
}
