import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { Check } from "@phosphor-icons/react/dist/csr/Check";

// Keep focus on the combobox while its portalled list avoids clipping in the roster.
export default function SelectField({ label, value, options, onChange, tone = "light" }) {
  const id = useId();
  const trigger = useRef(null);
  const menu = useRef(null);
  const search = useRef({ text: "", time: 0 });
  const selected = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [active, setActive] = useState(selected);
  const [position, setPosition] = useState(null);

  function show(index = selected) {
    setActive(index);
    setPresent(true);
    setOpen(true);
    search.current = { text: "", time: 0 };
  }

  function choose(index) {
    if (options[index] && String(options[index].value) !== String(value)) onChange(options[index].value);
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
    const topEdge = (viewport?.offsetTop ?? 0) + 8;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
    const below = Math.max(0, bottomEdge - rect.bottom - 5);
    const above = Math.max(0, rect.top - topEdge - 5);
    const height = Math.min(options.length * 42 + 10, 262);
    const upward = below < height && above > below;
    const maxHeight = Math.min(height, upward ? above : below);
    const width = Math.min(Math.max(rect.width, 100), rightEdge - leftEdge);
    setPosition({
      left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)),
      top: upward ? rect.top - maxHeight - 5 : rect.bottom + 5,
      width, maxHeight, transformOrigin: upward ? "bottom" : "top",
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!present || open) return;
    const timer = window.setTimeout(() => { setPresent(false); setPosition(null); }, 180);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    }
    function onScroll(event) {
      if (!menu.current?.contains(event.target)) setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    window.visualViewport?.addEventListener("resize", close);
    window.visualViewport?.addEventListener("scroll", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.visualViewport?.removeEventListener("resize", close);
      window.visualViewport?.removeEventListener("scroll", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position) return;
    const item = menu.current?.querySelector(`[data-index="${active}"]`);
    if (!item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < menu.current.scrollTop) menu.current.scrollTop = top;
    else if (bottom > menu.current.scrollTop + menu.current.clientHeight) menu.current.scrollTop = bottom - menu.current.clientHeight;
  }, [active, open, position]);

  function onKeyDown(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      if (open) choose(active);
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : Math.max(0, Math.min(options.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
      if (open) setActive(index);
      else show(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : selected);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
      const now = Date.now();
      const query = now - search.current.time < 700 ? search.current.text + event.key : event.key;
      const index = options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()));
      if (index >= 0) {
        event.preventDefault();
        if (open) setActive(index);
        else show(index);
      }
      search.current = { text: query, time: now };
    }
  }

  return <>
    <button ref={trigger} type="button" className={`select-trigger select-trigger--${tone}`}
      role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={present ? id : undefined} aria-activedescendant={open && position ? `${id}-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={onKeyDown}
      onBlur={() => setOpen(false)}>
      <span>{options[selected]?.label}</span><CaretDown size={16} weight="bold" aria-hidden="true" />
    </button>
    {present && position && createPortal(
      <div ref={menu} id={id} role="listbox" aria-label={label} aria-hidden={!open} inert={!open}
        className={`select-menu select-menu--${tone} ${open ? "is-open" : "is-closing"}`}
        style={position}>
        {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option"
          aria-selected={index === selected} data-index={index}
          className={`select-option ${index === active ? "is-active" : ""}`}
          onPointerMove={() => setActive(index)} onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(index)}>
          <span>{option.label}</span>{index === selected && <Check size={15} weight="bold" aria-hidden="true" />}
        </div>)}
      </div>, document.body)}
  </>;
}
