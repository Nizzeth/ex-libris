import { useEffect, useState } from "react";

let push = () => {};
export function toast(msg) {
  push(msg);
}

export function Toaster() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer;
    push = (m) => {
      setMsg(m);
      setShow(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 2000);
    };
    return () => {
      push = () => {};
      clearTimeout(timer);
    };
  }, []);
  return <div className={"toast" + (show ? " show" : "")}>{msg}</div>;
}
