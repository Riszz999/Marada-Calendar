const paths = {
  plus: "M12 5v14M5 12h14",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  close: "m6 6 12 12M6 18 18 6",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z",
  user: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  people:
    "M14 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M4 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3M18 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3",
  phone:
    "M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z",
  seating: "M7 13V4h10v9M5 10v6h14v-6M5 16v5m14-5v5M8 8h8",
  food: "M3 3v6a3 3 0 0 0 6 0V3M6 3v18M17 3c-3 3-3 7-3 10h5V3h-2Zm2 10v8",
  edit: "m14 5 5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  check: "m5 12 4 4L19 6",
  logout: "M9 4H4v16h5M9 12h12m-4-4 4 4-4 4",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v12H5V10Zm7 5v2",
};
export default function Icon({ name, ...props }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.calendar} />
    </svg>
  );
}
