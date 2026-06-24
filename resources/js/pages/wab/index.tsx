import { Head, router } from '@inertiajs/react';
import { type ElementType, type ReactNode, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Eye,
    KeyRound,
    Link2,
    LogOut,
    MessageCircle,
    RefreshCw,
    Search,
    Send,
    XCircle,
} from 'lucide-react';

type WabLog = {
    id: number;
    uuid: string;
    to_number: string;
    message: string;
    status: 'queued' | 'sending' | 'sent' | 'failed';
    provider_message_id: string | null;
    error_message: string | null;
    attempts: number;
    is_test: boolean;
    queued_at: string | null;
    sent_at: string | null;
    failed_at: string | null;
    created_at: string;
};

type PaginatedLogs = {
    data: WabLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
};

type Stats = { total: number; sent: number; failed: number; queued: number };

type WabState = 'open' | 'connecting' | 'logged_out' | 'unreachable';

type WabStatus = { state: WabState; phone?: string | null; since?: string | null; hasQr?: boolean };

type Props = {
    logs: PaginatedLogs;
    filters: { search?: string; status?: string };
    stats: Stats;
    testNumber: string | null;
};

const statusConfig = {
    queued: { label: 'Queued', variant: 'secondary' as const },
    sending: { label: 'Sending', variant: 'outline' as const },
    sent: { label: 'Sent', variant: 'default' as const },
    failed: { label: 'Failed', variant: 'destructive' as const },
};

const connectionConfig: Record<WabState, { label: string; dot: string; text: string }> = {
    open: { label: 'Connected', dot: 'bg-green-500', text: 'text-green-600' },
    connecting: { label: 'Connecting…', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-600' },
    logged_out: { label: 'Logged out', dot: 'bg-red-500', text: 'text-red-600' },
    unreachable: { label: 'Unreachable', dot: 'bg-red-500', text: 'text-red-600' },
};

function xsrf(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

async function postJson<T = Record<string, unknown>>(url: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'X-XSRF-TOKEN': xsrf(),
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

function StatusBadge({ status }: { status: WabLog['status'] }) {
    const config = statusConfig[status] ?? statusConfig.queued;
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDate(dateStr: string | null | undefined): string {
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

function LogDetailModal({ log, open, onClose }: { log: WabLog | null; open: boolean; onClose: () => void }) {
    if (!log) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        WhatsApp Log Detail
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <StatusBadge status={log.status} />
                        {log.is_test && <Badge variant="outline">Test</Badge>}
                        <span className="text-xs text-muted-foreground font-mono">{log.uuid}</span>
                    </div>

                    <Separator />

                    <dl className="divide-y">
                        <DetailRow label="To" value={log.to_number} />
                        <DetailRow label="Attempts" value={String(log.attempts)} />
                        <DetailRow label="Provider Msg ID" value={log.provider_message_id} />
                        <DetailRow label="Queued At" value={formatDate(log.queued_at)} />
                        <DetailRow label="Sent At" value={formatDate(log.sent_at)} />
                        <DetailRow label="Failed At" value={formatDate(log.failed_at)} />
                        {log.error_message && (
                            <DetailRow
                                label="Error"
                                value={<span className="text-destructive text-xs font-mono">{log.error_message}</span>}
                            />
                        )}
                    </dl>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                        <pre className="text-sm bg-muted rounded p-3 whitespace-pre-wrap break-words">{log.message}</pre>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ConnectionPanel({ testNumber }: { testNumber: string | null }) {
    const [status, setStatus] = useState<WabStatus>({ state: 'connecting' });
    const [number, setNumber] = useState('');
    const [pairCode, setPairCode] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/wab/status', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            setStatus(await res.json());
        } catch {
            setStatus({ state: 'unreachable' });
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const t = setInterval(fetchStatus, 5000);
        return () => clearInterval(t);
    }, [fetchStatus]);

    const generateCode = async () => {
        if (!number.trim()) {
            toast.error('Enter the phone number first (digits only, with country code).');
            return;
        }
        setBusy('pair');
        setPairCode(null);
        const res = await postJson<{ success: boolean; code?: string; message?: string }>('/wab/pair', { number });
        setBusy(null);
        if (res.success && res.code) {
            setPairCode(res.code);
        } else {
            toast.error(res.message ?? 'Failed to generate pairing code.');
        }
    };

    const doReconnect = async () => {
        setBusy('reconnect');
        await postJson('/wab/reconnect');
        setBusy(null);
        toast.success('Reconnect triggered.');
        setTimeout(fetchStatus, 1500);
    };

    const doLogout = async () => {
        if (!confirm('Log out the current WhatsApp session? You will need to re-link with a pairing code.')) return;
        setBusy('logout');
        await postJson('/wab/logout');
        setBusy(null);
        setPairCode(null);
        toast.success('Logged out. Generate a new pairing code to re-link.');
        setTimeout(fetchStatus, 1500);
    };

    const sendTest = async () => {
        setBusy('test');
        const res = await postJson<{ success: boolean; message?: string }>('/wab/send-test');
        setBusy(null);
        if (res.success) toast.success('Test message queued.');
        else toast.error(res.message ?? 'Failed to queue test message.');
    };

    const conn = connectionConfig[status.state] ?? connectionConfig.unreachable;
    const connected = status.state === 'open';

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${conn.dot}`} />
                    <div>
                        <p className={`font-semibold ${conn.text}`}>{conn.label}</p>
                        <p className="text-xs text-muted-foreground">
                            {connected && status.phone
                                ? `${status.phone} · since ${formatDate(status.since)}`
                                : 'WhatsApp Baileys session'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStatus}>
                        <RefreshCw className="h-4 w-4" /> Check now
                    </Button>
                    <Button variant="outline" size="sm" onClick={sendTest} disabled={!connected || busy === 'test'}>
                        <Send className="h-4 w-4" /> Send test
                    </Button>
                    <Button variant="outline" size="sm" onClick={doReconnect} disabled={busy === 'reconnect'}>
                        <RefreshCw className="h-4 w-4" /> Reconnect
                    </Button>
                    <Button variant="outline" size="sm" onClick={doLogout} disabled={busy === 'logout'}>
                        <LogOut className="h-4 w-4" /> Re-link / Logout
                    </Button>
                </div>
            </div>

            {/* Linking panel — shown when not connected */}
            {!connected && (
                <>
                    <Separator className="my-4" />
                    <div className="flex flex-col gap-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <Link2 className="h-4 w-4" /> Link a number (pairing code)
                        </p>
                        <p className="text-xs text-muted-foreground">
                            QR scanning is blocked from the server's IP. Enter the number (country code, digits only),
                            generate an 8-character code, then on the phone: WhatsApp → Linked Devices → Link a Device →
                            <strong> "Link with phone number instead"</strong> → enter the code.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Input
                                placeholder="e.g. 447848103867"
                                value={number}
                                onChange={(e) => setNumber(e.target.value)}
                                className="w-56"
                            />
                            <Button size="sm" onClick={generateCode} disabled={busy === 'pair'}>
                                <KeyRound className="h-4 w-4" /> Generate pairing code
                            </Button>
                        </div>
                        {pairCode && (
                            <div className="rounded-md border bg-muted/40 p-4">
                                <p className="text-xs text-muted-foreground">Enter this on the phone:</p>
                                <p className="mt-1 text-3xl font-bold tracking-[0.3em] font-mono">{pairCode}</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {connected && testNumber && (
                <p className="mt-3 text-xs text-muted-foreground">Keep-warm test target: {testNumber}</p>
            )}
        </div>
    );
}

export default function WabPage({ logs, filters, stats, testNumber }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedLog, setSelectedLog] = useState<WabLog | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const applyFilters = useCallback(
        (params: { search?: string; status?: string }) => {
            router.get('/wab', { ...filters, ...params }, { preserveState: true, replace: true });
        },
        [filters],
    );

    const handleSearch = useCallback(
        (value: string) => {
            setSearch(value);
            clearTimeout((window as typeof window & { _wabSearchTimer?: ReturnType<typeof setTimeout> })._wabSearchTimer);
            (window as typeof window & { _wabSearchTimer?: ReturnType<typeof setTimeout> })._wabSearchTimer = setTimeout(
                () => applyFilters({ search: value, status: filters.status }),
                400,
            );
        },
        [applyFilters, filters.status],
    );

    const openDetail = (log: WabLog) => {
        setSelectedLog(log);
        setModalOpen(true);
    };

    return (
        <>
            <Head title="WhatsApp" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <ConnectionPanel testNumber={testNumber} />

                {/* Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Sent" value={stats.total} icon={MessageCircle} color="text-foreground" />
                    <StatCard label="Delivered" value={stats.sent} icon={CheckCircle} color="text-green-600" />
                    <StatCard label="Failed" value={stats.failed} icon={XCircle} color="text-destructive" />
                    <StatCard label="Pending" value={stats.queued} icon={Clock} color="text-amber-500" />
                </div>

                {/* Table card */}
                <div className="flex flex-col gap-4 rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-semibold">WhatsApp Logs</h2>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search number, message…"
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-8 w-64"
                                />
                            </div>
                            <Select
                                value={filters.status ?? 'all'}
                                onValueChange={(value) =>
                                    applyFilters({ search: filters.search, status: value === 'all' ? undefined : value })
                                }
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

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">To</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Queued</th>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sent</th>
                                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {logs.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                            No messages found.
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
                                                <div className="font-medium">{log.to_number}</div>
                                                {log.is_test && <div className="text-xs text-muted-foreground">test</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="truncate max-w-[280px]">{log.message}</div>
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
                                        router.get('/wab', { ...filters, page: logs.current_page - 1 }, { preserveState: true })
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
                                        router.get('/wab', { ...filters, page: logs.current_page + 1 }, { preserveState: true })
                                    }
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <LogDetailModal log={selectedLog} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: ElementType; color: string }) {
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

WabPage.layout = {
    breadcrumbs: [{ title: 'WhatsApp', href: '/wab' }],
};
