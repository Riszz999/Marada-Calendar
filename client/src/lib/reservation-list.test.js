import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { serializeReservation } from "../../../server/src/lib/mask.js";

test("reservation list preserves role visibility and booking content", async (t) => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "th" };
  const server = await createServer({
    cacheDir: "node_modules/.vite-ui-tests",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  try {
    const { default: ReservationList } = await server.ssrLoadModule(
      "/src/components/ReservationList.jsx",
    );
    const { LangProvider } = await server.ssrLoadModule(
      "/src/context/LangContext.jsx",
    );
    const { default: Calendar } = await server.ssrLoadModule(
      "/src/components/Calendar.jsx",
    );
    const renderCalendar = (props = {}) =>
      renderToStaticMarkup(
        React.createElement(
          LangProvider,
          null,
          React.createElement(Calendar, {
            year: 2026,
            month: 7,
            selectedDate: "2026-08-06",
            bookedDates: new Set(["2026-08-06"]),
            ...props,
          }),
        ),
      );
    await t.test('calendar separates confirmed and pending markers without showing pending markers to staff',()=>{
      const html=renderCalendar({requestedDates:new Set(['2026-08-06','2026-08-07'])});
      assert.equal((html.match(/day-marker has-booking/g)||[]).length,1);
      assert.equal((html.match(/day-marker has-request/g)||[]).length,2);
      assert.match(html,/aria-label="[^"]*รอยืนยัน/);
      assert.doesNotMatch(renderCalendar(),/has-request/);
    });
    await t.test('calendar keeps dates and loading semantics without placeholder bars beneath dates', () => {
      for (const props of [{loading:true}, {requestLoading:true}, {loading:true,requestLoading:true}]) {
        const html=renderCalendar(props);
        assert.equal((html.match(/data-day=/g)||[]).length,31);
        assert.match(html,/aria-busy="true"/);
        assert.match(html,/กำลังโหลด/);
        assert.doesNotMatch(html,/sk-marker|class="skeleton/);
      }
    });
    await t.test(
      "six-row months keep all dates and exactly one selected day",
      () => {
        const html = renderCalendar();
        assert.equal((html.match(/data-day=/g) || []).length, 31);
        assert.equal((html.match(/class="day-empty"/g) || []).length, 11);
        assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
        assert.equal((html.match(/day-marker has-booking/g) || []).length, 1);
        const days = html.split('class="days"')[1];
        assert.doesNotMatch(days, /<svg/);
        assert.match(html, /<button[^>]*class="day-empty"[^>]*aria-label=/);
        assert.match(html, /class="day-number">1<\/span>/);
        assert.doesNotMatch(html, /class="day-number">0[1-9]<\/span>/);
      },
    );
    await t.test(
      "adjacent dates carry the correct target across year and leap-month boundaries",
      () => {
        const january = renderCalendar({ year: 2027, month: 0 });
        assert.match(january, /class="day-empty"[^>]*data-date="2026-12-31"/);
        assert.match(january, /class="day-empty"[^>]*data-date="2027-02-01"/);
        const march = renderCalendar({ year: 2028, month: 2 });
        assert.match(march, /class="day-empty"[^>]*data-date="2028-02-29"/);
      },
    );
    await t.test(
      "today and selection retain separate semantics; loading hides booking markers",
      () => {
        const now = new Date();
        const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const html = renderCalendar({
          year: now.getFullYear(),
          month: now.getMonth(),
          selectedDate: key,
          bookedDates: new Set([key]),
        });
        assert.match(html, /class="day is-today is-selected"/);
        assert.match(html, /aria-current="date"/);
        assert.doesNotMatch(
          renderCalendar({ loading: true }),
          /day-marker has-booking/,
        );
        assert.doesNotMatch(
          renderCalendar({ loadError: true }),
          /day-marker has-booking/,
        );
      },
    );
    await t.test(
      "month sheet supports four and five rows, including leap February",
      () => {
        for (const [year, month, days, blanks] of [
          [2026, 1, 28, 0],
          [2028, 1, 29, 6],
          [2026, 8, 30, 5],
        ]) {
          const html = renderCalendar({
            year,
            month,
            selectedDate: `${year}-${String(month + 1).padStart(2, "0")}-01`,
          });
          assert.equal((html.match(/data-day=/g) || []).length, days);
          assert.equal((html.match(/class="day-empty"/g) || []).length, blanks);
          assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
        }
      },
    );
    await t.test(
      "month navigation retains accessible names and localized year without footer controls",
      () => {
        const html = renderCalendar();
        assert.match(html, /aria-label="เดือนก่อนหน้า"/);
        assert.match(html, /aria-label="เดือนถัดไป"/);
        assert.doesNotMatch(html, /calendar-footer|calendar-legend|today-btn/);
        assert.match(html, /<small>พ.ศ. 2569<\/small>/);
      },
    );
    await t.test(
      "an out-of-month selection leaves one date reachable by keyboard",
      () => {
        const html = renderCalendar({ selectedDate: "2026-09-06" });
        assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
        assert.match(html, /data-day="1"[^>]*tabindex="0"/);
        assert.equal((html.match(/aria-pressed="true"/g) || []).length, 0);
      },
    );
    const row = {
      id: 1,
      reserved_date: "2026-09-06",
      reserved_time: "18:30:00",
      customer_name: "UI fixture",
      phone: "0000000000",
      seats: 4,
      zone: "",
      food_order: "Prawns\nSoup <script>not executable</script>",
    };
    await t.test('details are read-only and deletion is available only in the edit form', async () => {
      const { default: Detail } = await server.ssrLoadModule('/src/components/ReservationDetail.jsx');
      const { default: Form } = await server.ssrLoadModule('/src/components/ReservationForm.jsx');
      const reservation = serializeReservation(row, 'admin');
      const renderComponent = (Component, props) => renderToStaticMarkup(
        React.createElement(LangProvider, null, React.createElement(Component, props)),
      );
      const detail = renderComponent(Detail, { reservation });
      assert.equal((detail.match(/<button/g) || []).length, 1, 'only the close button remains');
      assert.match(detail, /UI fixture/);
      const edit = renderComponent(Form, { mode: 'edit', date: reservation.date, initial: reservation, onDelete: () => {} });
      assert.match(edit, />ลบการจอง<\/button>/);
      assert.doesNotMatch(edit, />ยกเลิก<\/button>/);
      const requestEdit = renderComponent(Form, { mode: 'edit', title: 'แก้ไขคำขอจอง', date: reservation.date, initial: reservation });
      assert.match(requestEdit, /แก้ไขคำขอจอง/);
      assert.doesNotMatch(requestEdit, />ยกเลิก<\/button>/);
      assert.doesNotMatch(requestEdit, />ลบการจอง<\/button>/);
      assert.match(requestEdit, /บันทึกการแก้ไข/);
      const create = renderComponent(Form, { mode: 'create', date: reservation.date });
      assert.doesNotMatch(create, />ยกเลิก<\/button>/);
      assert.doesNotMatch(create, />ลบการจอง<\/button>/);
    });
    const render = (props = {}) =>
      renderToStaticMarkup(
        React.createElement(
          LangProvider,
          null,
          React.createElement(ReservationList, {
            date: row.reserved_date,
            items: [serializeReservation(row, "admin")],
            isAdmin: true,
            ...props,
          }),
        ),
      );
    await t.test(
      "admin can edit and call; labelled information has navigation icons",
      () => {
        const html = render();
        assert.match(html, /class="edit-btn"/);
        assert.match(html, /href="tel:0000000000"/);
        assert.equal((html.match(/<dt><svg/g) || []).length, 4);
        assert.match(html, /reservation-guest/);
        assert.match(html, /reservation-phone/);
        assert.match(
          html,
          /<footer class="reservation-actions">.*class="detail-link".*class="edit-btn".*<\/footer>/,
        );
        const arrival = html
          .split('<div class="reservation-heading">')[1]
          .split("<dl")[0];
        assert.doesNotMatch(arrival, /<button/);
      },
    );
    await t.test(
      "staff has no edit or full phone and keeps details access",
      () => {
        const html = render({
          items: [serializeReservation(row, "staff")],
          isAdmin: false,
        });
        assert.doesNotMatch(html, /edit-btn|tel:|0000000000/);
        assert.match(html, /000-xxx-0000/);
        assert.match(html, /detail-link/);
      },
    );
    await t.test(
      "free-text food retains line breaks and escapes markup",
      () => {
        const html = render();
        assert.match(html, /Prawns\nSoup &lt;script&gt;/);
        assert.doesNotMatch(html, /<script>/);
      },
    );
    await t.test("missing seating and food display dashes", () => {
      const html = render({
        items: [serializeReservation({ ...row, food_order: "" }, "admin")],
      });
      assert.match(html, /<dd>-<\/dd>/);
      assert.match(html, /<dd class="muted">-<\/dd>/);
      assert.doesNotMatch(html, /ให้ร้านจัดที่นั่ง|ไม่ได้สั่งอาหารล่วงหน้า/);
    });
    await t.test("loading and errors do not present the day as empty", () => {
      assert.match(render({ loading: true, items: [] }), /reservation-skeleton/);
      assert.doesNotMatch(render({ loading: true, items: [] }), /list-empty|empty-state/);
      const html = render({ loadError: true, items: [] });
      assert.match(html, /role="alert"/);
      assert.doesNotMatch(html, /agenda-count/);
    });
    await t.test('structural skeletons have status labels and no focusable placeholders', async () => {
      const skeletons=await server.ssrLoadModule('/src/components/Skeleton.jsx');
      for(const name of ['SessionSkeleton','ReservationSkeleton','RequestSkeleton','StaffKeySkeleton','UsersSkeleton']) {
        const html=renderToStaticMarkup(React.createElement(LangProvider,null,React.createElement(skeletons[name])));
        assert.match(html,/aria-busy="true"/);
        assert.match(html,/class="sr-only">กำลังโหลด/);
        assert.doesNotMatch(html,/<button|<input|<a\s/);
      }
    });
    await t.test('pending actions show task text without a progress bar and reserve both label sizes', async () => {
      const {default:ActionButton}=await server.ssrLoadModule('/src/components/ActionButton.jsx');
      const html=renderToStaticMarkup(React.createElement(LangProvider,null,React.createElement(ActionButton,{status:{phase:'pending',action:'save'},pendingLabel:'กำลังบันทึก'},'บันทึก')));
      assert.match(html,/aria-busy="true"/);
      assert.match(html,/disabled=""/);
      assert.match(html,/pending-original[^>]*>บันทึก/);
      assert.match(html,/pending-label[^>]*visibility:visible[^>]*>กำลังบันทึก</);
      assert.doesNotMatch(html,/button-progress/);
      const idle=renderToStaticMarkup(React.createElement(LangProvider,null,React.createElement(ActionButton,{status:{phase:'idle'},pendingLabel:'กำลังบันทึก'},'บันทึก')));
      assert.match(idle,/pending-label[^>]*aria-hidden="true"[^>]*visibility:hidden[^>]*>กำลังบันทึก</);
      const {default:PendingButton}=await server.ssrLoadModule('/src/components/PendingButton.jsx');
      const login=renderToStaticMarkup(React.createElement(LangProvider,null,React.createElement(PendingButton,{pending:true,pendingLabel:'กำลังเข้าสู่ระบบ'},'เข้าสู่ระบบ')));
      assert.match(login,/pending-label[^>]*visibility:visible[^>]*>กำลังเข้าสู่ระบบ</);
      assert.match(login,/disabled=""/);
      assert.doesNotMatch(login,/button-progress/);
    });
    await t.test('calendar skeleton shares the real calendar structure and current month row count without interactive controls', async () => {
      const { SessionSkeleton } = await server.ssrLoadModule('/src/components/Skeleton.jsx');
      for (const [year, month, count] of [[2026,1,28],[2026,8,35],[2026,7,42],[2028,1,35],[2026,11,35]]) {
        const html=renderToStaticMarkup(React.createElement(LangProvider,null,React.createElement(SessionSkeleton,{year,month})));
        const real=renderCalendar({year,month});
        assert.equal((html.match(/class="day"/g)||[]).length,count);
        assert.equal((real.match(/class="day(?: |")|class="day-empty"/g)||[]).length,count);
        for (const cls of ['calendar-toolbar','calendar-sheet','weekdays','days']) assert.ok(html.includes(`class="${cls}"`));
        assert.match(html,/calendar is-skeleton/);
        assert.doesNotMatch(html,/<button|tabindex=|id="calendar-month"|data-refresh-track|skeleton-calendar-grid/);
      }
    });
  } finally {
    await server.close();
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
