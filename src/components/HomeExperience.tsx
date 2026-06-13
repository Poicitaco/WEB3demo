"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const modules = [
  {
    index: '01',
    title: 'Gửi riêng tư',
    copy: 'Gửi hợp đồng, báo cáo hoặc tài liệu quan trọng bằng một liên kết chỉ đúng người mới mở được.',
    href: '/upload',
    action: 'Gửi một tệp',
    state: 'Chỉ người được mời',
  },
  {
    index: '02',
    title: 'Làm việc nhóm',
    copy: 'Tạo không gian chung, mời thành viên và quyết định ai được xem hoặc cập nhật tài liệu.',
    href: '/dashboard',
    action: 'Tạo không gian nhóm',
    state: 'Phân quyền rõ ràng',
  },
  {
    index: '03',
    title: 'Kiểm soát',
    copy: 'Đặt ngày hết hạn, giới hạn lượt tải, thu hồi liên kết và xem lại lịch sử chia sẻ.',
    href: '/dashboard',
    action: 'Xem quyền truy cập',
    state: 'Sau khi đã gửi',
  },
];

const events = [
  ['Liên kết có thời hạn', 'Tự đóng sau thời gian bạn chọn', 'chia sẻ', 'có sẵn'],
  ['Thu hồi sau khi gửi', 'Dừng quyền truy cập ngay lập tức', 'kiểm soát', 'có sẵn'],
  ['Không gian làm việc chung', 'Phân vai trò cho từng thành viên', 'cộng tác', 'có sẵn'],
  ['Nhiều người cùng duyệt', 'Tài liệu nhạy cảm cần đủ người đồng ý', 'an toàn', 'có sẵn'],
];

export default function HomeExperience() {
  const root = useRef<HTMLElement>(null);
  const [hydrated, setHydrated] = useState(false);

  useGSAP(() => {
    if (!hydrated) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.builder-reveal', {
        y: 18,
        autoAlpha: 0,
        duration: .7,
        stagger: .06,
        ease: 'power3.out',
      });
      gsap.from('.flow-node', {
        scale: .6,
        autoAlpha: 0,
        duration: .6,
        stagger: .08,
        delay: .35,
        ease: 'back.out(1.4)',
      });
      gsap.to('.flow-pulse', {
        xPercent: 650,
        duration: 3,
        repeat: -1,
        repeatDelay: 1.4,
        ease: 'power2.inOut',
      });
      gsap.to('.event-mark', {
        scale: 1.8,
        autoAlpha: .35,
        duration: 1.1,
        stagger: .18,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.approved', {
        boxShadow: '0 0 24px rgba(120,228,110,.26)',
        duration: 1.4,
        stagger: .16,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.orb-core', {
        y: -12,
        rotation: 4,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.orb-ring-one', {
        rotation: 360,
        duration: 18,
        repeat: -1,
        ease: 'none',
      });
      gsap.to('.orb-ring-two', {
        rotation: -360,
        duration: 24,
        repeat: -1,
        ease: 'none',
      });
      ScrollTrigger.batch('.module-card, .activity-row', {
        start: 'top 92%',
        once: true,
        onEnter: (items) => gsap.from(items, {
          y: 20,
          autoAlpha: 0,
          duration: .65,
          stagger: .07,
          ease: 'power3.out',
        }),
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [hydrated], revertOnUpdate: true });

  useEffect(() => setHydrated(true), []);

  return (
    <main ref={root} className="builder-home">
      <section className="builder-intro builder-reveal">
        <div className="builder-path">/ chia sẻ tài liệu quan trọng</div>
        <div className="builder-intro-grid">
          <div>
            <h1>Gửi tệp.<br /><span>Giữ quyền kiểm soát.</span></h1>
            <p>Mã hoá trước khi tệp rời thiết bị. Chỉ người bạn cho phép mới có thể mở, và bạn vẫn có thể thu hồi quyền sau khi gửi.</p>
            <div className="hero-actions">
              <Link href="/upload" className="btn-primary">Gửi tài liệu</Link>
              <Link href="/dashboard" className="btn-secondary">Mở không gian của bạn</Link>
            </div>
          </div>
          <div className="vault-orb" aria-hidden="true">
            <span className="orb-ring orb-ring-one" />
            <span className="orb-ring orb-ring-two" />
            <span className="orb-core"><i /><strong>V</strong></span>
            <span className="orb-chip orb-chip-one">Riêng tư</span>
            <span className="orb-chip orb-chip-two">Bạn kiểm soát</span>
          </div>
        </div>
      </section>

      <section className="builder-grid builder-reveal">
        <article className="transfer-module">
          <div className="module-bar">
            <span>Một tệp được gửi như thế nào</span>
            <span className="status-dot">Sẵn sàng</span>
          </div>
          <div className="transfer-route">
            <div className="flow-node">
              <i>01</i>
              <strong>Chọn tệp</strong>
              <span>tệp vẫn ở trên thiết bị</span>
            </div>
            <div className="flow-line"><i className="flow-pulse" /></div>
            <div className="flow-node">
              <i>02</i>
              <strong>Khoá riêng tư</strong>
              <span>nội dung được bảo vệ</span>
            </div>
            <div className="flow-line"><i className="flow-pulse" /></div>
            <div className="flow-node">
              <i>03</i>
              <strong>Đúng người</strong>
              <span>chỉ người được mời có thể mở</span>
            </div>
          </div>
          <div className="transfer-footer">
            <span>Nội dung tệp</span><strong>Luôn riêng tư</strong>
            <span>Bạn có thể thu hồi</span><strong>Bất cứ lúc nào</strong>
          </div>
        </article>

        <aside className="account-module control-module">
          <div className="module-bar"><span>Kiểm soát sau khi gửi</span><span>Thuộc về bạn</span></div>
          <div className="control-statement">
            <span>Quyền truy cập không kết thúc khi bạn nhấn gửi.</span>
            <strong>Bạn vẫn<br />giữ quyền.</strong>
          </div>
          <div className="control-list">
            <div><i>01</i><span>Thu hồi quyền truy cập</span><small>Bất cứ lúc nào</small></div>
            <div><i>02</i><span>Đặt thời hạn tự động</span><small>Theo từng liên kết</small></div>
            <div><i>03</i><span>Theo dõi lịch sử mở tệp</span><small>Minh bạch</small></div>
          </div>
          <Link href="/dashboard" className="module-action">Mở trung tâm kiểm soát <span>↗</span></Link>
        </aside>
      </section>

      <section className="module-list builder-reveal">
        <div className="section-bar">
          <span>/ không chỉ gửi và tải xuống</span>
          <p>Vaultline giúp bạn tiếp tục kiểm soát tài liệu sau khi đã chia sẻ.</p>
        </div>
        <div className="module-cards">
          {modules.map((module) => (
            <Link href={module.href} className="module-card" key={module.title}>
              <div className="module-card-top"><span>{module.index}</span><small>{module.state}</small></div>
              <div>
                <h2>{module.title}</h2>
                <p>{module.copy}</p>
              </div>
              <strong>{module.action}<span>↗</span></strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="activity-module builder-reveal">
        <div className="section-bar">
          <span>/ những gì bạn có thể làm</span>
          <p>Các khả năng đã có sẵn cho tài liệu cá nhân và không gian nhóm.</p>
        </div>
        <div className="activity-table">
          {events.map(([event, target, value, status]) => (
            <div className="activity-row" key={event}>
              <span className="event-mark" />
              <strong>{event}</strong>
              <span>{target}</span>
              <span>{value}</span>
              <small>{status}</small>
            </div>
          ))}
        </div>
      </section>

      <footer className="builder-footer builder-reveal">
        <span>VAULTLINE / BUILDER</span>
        <span>Gửi riêng tư · làm việc nhóm · kiểm soát quyền truy cập</span>
        <Link href="/upload">Gửi tệp đầu tiên ↗</Link>
      </footer>
    </main>
  );
}
