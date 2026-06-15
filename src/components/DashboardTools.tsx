"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const VaultManager = dynamic(() => import('@/components/VaultManager'), { loading: ToolLoading });
const ApprovalManager = dynamic(() => import('@/components/ApprovalManager'), { loading: ToolLoading });
const VersionHistory = dynamic(() => import('@/components/VersionHistory'), { loading: ToolLoading });
const TokenIssuer = dynamic(() => import('@/components/TokenIssuer'), { loading: ToolLoading });
const TokenManager = dynamic(() => import('@/components/TokenManager'), { loading: ToolLoading });

type Tool = 'links' | 'vaults' | 'approvals' | 'versions';

function ToolLoading() {
  return <div className="tool-loading"><span /><small>Đang tải công cụ...</small></div>;
}

const tools: Array<{ id: Tool; title: string; copy: string }> = [
  { id: 'links', title: 'Liên kết chia sẻ', copy: 'Tạo, thu hồi hoặc cấp lại quyền truy cập' },
  { id: 'vaults', title: 'Không gian nhóm', copy: 'Quản lý thành viên và vai trò' },
  { id: 'approvals', title: 'Phê duyệt', copy: 'Xử lý tài liệu cần nhiều người đồng ý' },
  { id: 'versions', title: 'Phiên bản', copy: 'Kiểm tra lịch sử thay đổi của tệp' },
];

export default function DashboardTools() {
  const [active, setActive] = useState<Tool>('links');

  useEffect(() => {
    const openTool = (event: Event) => {
      const tool = (event as CustomEvent<Tool>).detail;
      if (tools.some((item) => item.id === tool)) {
        setActive(tool);
        document.getElementById('dashboard-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('dashboard:tool', openTool);
    return () => window.removeEventListener('dashboard:tool', openTool);
  }, []);

  return (
    <section className="dashboard-tools" id="dashboard-management">
      <div className="dashboard-tools-heading">
        <div><span>Công cụ quản trị</span><h2>Chỉ tải phần bạn cần sử dụng.</h2></div>
        <small>Công cụ đang mở: {tools.find((tool) => tool.id === active)?.title}</small>
      </div>
      <div className="dashboard-management-layout">
        <nav className="dashboard-tool-grid" aria-label="Công cụ quản lý">
          {tools.map((tool, index) => (
            <button type="button" key={tool.id} className={active === tool.id ? 'active' : ''} onClick={() => setActive(tool.id)}>
              <b>{String(index + 1).padStart(2, '0')}</b><strong>{tool.title}</strong><span>{tool.copy}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="dashboard-tool-panel">
          {active === 'links' && <div className="space-y-4"><TokenIssuer /><TokenManager /></div>}
          {active === 'vaults' && <VaultManager />}
          {active === 'approvals' && <div id="approval-requests"><ApprovalManager /></div>}
          {active === 'versions' && <VersionHistory />}
        </div>
      </div>
    </section>
  );
}
