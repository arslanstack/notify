import { Head, router } from '@inertiajs/react';
import { type ElementType, type ReactNode, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { dashboard } from '@/routes';
import { CheckCircle, ChevronLeft, ChevronRight, Clock, Eye, Mail, Search, XCircle } from 'lucide-react';

type MailLog = {
    id: number;
    uuid: string;
    to_email: string;
    to_name: string | null;
    from_email: string;
    from_name: string;
    subject: string;
    body_html: string;
    body_text: string | null;
    reply_to_email: string | null;
    reply_to_name: string | null;
    cc: string[] | null;
    bcc: string[] | null;
    headers: Record<string, string> | null;
    status: 'queued' | 'sending' | 'sent' | 'failed';
    smtp_response: string | null;
    error_message: string | null;
    attempts: number;
    api_payload: Record<string, unknown> | null;
    queued_at: string | null;
    sent_at: string | null;
    failed_at: string | null;
    created_at: string;
};

type PaginatedLogs = {
    data: MailLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Stats = {
    total: number;
    sent: number;
    failed: number;
    queued: number;
};

type Props = {
    logs: PaginatedLogs;
    filters: { search?: string; status?: string };
    stats: Stats;
};

const statusConfig = {
    queued: { label: 'Queued', variant: 'secondary' as const, icon: Clock },
    sending: { label: 'Sending', variant: 'outline' as const, icon: Mail },
    sent: { label: 'Sent', variant: 'default' as const, icon: CheckCircle },
    failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
};

function StatusBadge({ status }: { status: MailLog['status'] }) {
    const config = statusConfig[status] ?? statusConfig.queued;
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    if (!value) return null;
    return (
        <div className="grid grid-cols-3 gap-2 py-2">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="col-span-2 text-sm break-all">{value}</dd>
        </div>
    );
}

function LogDetailModal({ log, open, onClose }: { log: MailLog | null; open: boolean; onClose: () => void }) {
    if (!log) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Log Detail
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <StatusBadge status={log.status} />
                        <span className="text-xs text-muted-foreground font-mono">{log.uuid}</span>
                    </div>

                    <Separator />

                    <dl className="divide-y">
                        <DetailRow label="To" value={log.to_name ? `${log.to_name} <${log.to_email}>` : log.to_email} />
                        <DetailRow label="From" value={`${log.from_name} <${log.from_email}>`} />
                        <DetailRow label="Subject" value={log.subject} />
                        {log.reply_to_email && (
                            <DetailRow
                                label="Reply-To"
                                value={log.reply_to_name ? `${log.reply_to_name} <${log.reply_to_email}>` : log.reply_to_email}
                            />
                        )}
                        {log.cc && log.cc.length > 0 && (
                            <DetailRow label="CC" value={log.cc.join(', ')} />
                        )}
                        {log.bcc && log.bcc.length > 0 && (
                            <DetailRow label="BCC" value={log.bcc.join(', ')} />
                        )}
                        <DetailRow label="Attempts" value={String(log.attempts)} />
                        <DetailRow label="Queued At" value={formatDate(log.queued_at)} />
                        <DetailRow label="Sent At" value={formatDate(log.sent_at)} />
                        <DetailRow label="Failed At" value={formatDate(log.failed_at)} />
                        {log.smtp_response && (
                            <DetailRow
                                label="SMTP Response"
                                value={
                                    <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap overflow-x-auto">
                                        {log.smtp_response}
                                    </pre>
                                }
                            />
                        )}
                        {log.error_message && (
                            <DetailRow
                                label="Error"
                                value={
                                    <span className="text-destructive text-xs font-mono">{log.error_message}</span>
                                }
                            />
                        )}
                    </dl>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">HTML Body Preview</p>
                        <div className="border rounded-md overflow-hidden bg-white">
                            <iframe
                                srcDoc={log.body_html}
                                className="w-full h-64"
                                sandbox="allow-same-origin"
                                title="Email preview"
                            />
                        </div>
                    </div>

                    {log.headers && Object.keys(log.headers).length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">Custom Headers</p>
                                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                                    {JSON.stringify(log.headers, null, 2)}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Dashboard({ logs, filters, stats }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedLog, setSelectedLog] = useState<MailLog | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const applyFilters = useCallback(
        (params: { search?: string; status?: string }) => {
            router.get(
                dashboard(),
                { ...filters, ...params },
                { preserveState: true, replace: true },
            );
        },
        [filters],
    );

    const handleSearch = useCallback(
        (value: string) => {
            setSearch(value);
            clearTimeout((window as typeof window & { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer);
            (window as typeof window & { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(
                () => applyFilters({ search: value, status: filters.status }),
                400,
            );
        },
        [applyFilters, filters.status],
    );

    const handleStatusFilter = useCallback(
        (value: string) => {
            applyFilters({ search: filters.search, status: value === 'all' ? undefined : value });
        },
        [applyFilters, filters.search],
    );

    const openDetail = (log: MailLog) => {
        setSelectedLog(log);
        setModalOpen(true);
    };

    return (
        <>
            <Head title="Mail Logs" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Sent" value={stats.total} icon={Mail} color="text-foreground" />
                    <StatCard label="Delivered" value={stats.sent} icon={CheckCircle} color="text-green-600" />
                    <StatCard label="Failed" value={stats.failed} icon={XCircle} color="text-destructive" />
                    <StatCard label="Pending" value={stats.queued} icon={Clock} color="text-amber-500" />
                </div>

                {/* Table card */}
                <div className="flex flex-col gap-4 rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-semibold">Mail Logs</h2>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search email, subject…"
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-8 w-64"
                                />
                            </div>
                            <Select
                                value={filters.status ?? 'all'}
                                onValueChange={handleStatusFilter}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="queued">Queued</SelectItem>
                                    <SelectItem value="sending">Sending</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">To</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">From</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subject</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Queued</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sent</th>
                                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {logs.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                            No emails found.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.data.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => openDetail(log)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium truncate max-w-[160px]">{log.to_email}</div>
                                                {log.to_name && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{log.to_name}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="truncate max-w-[160px]">{log.from_email}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="truncate max-w-[200px]">{log.subject}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={log.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(log.queued_at)}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(log.sent_at)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDetail(log);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.last_page > 1 && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                                Showing {logs.from}–{logs.to} of {logs.total}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.current_page === 1}
                                    onClick={() =>
                                        router.get(
                                            dashboard(),
                                            { ...filters, page: logs.current_page - 1 },
                                            { preserveState: true },
                                        )
                                    }
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-3 py-1.5 text-xs">
                                    {logs.current_page} / {logs.last_page}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.current_page === logs.last_page}
                                    onClick={() =>
                                        router.get(
                                            dashboard(),
                                            { ...filters, page: logs.current_page + 1 },
                                            { preserveState: true },
                                        )
                                    }
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <LogDetailModal
                log={selectedLog}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: number;
    icon: ElementType;
    color: string;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
        </div>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
