// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Select,
	Text,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { queryKeys } from "~/queries/keys";

export function meta() {
	return [{ title: "MAH Quantum Mail | MQ Mailer" }];
}

export default function HomeRoute() {
	const toastManager = useKumoToastManager();
	const { data: mailboxes = [], refetch: refetchMailboxes, isFetched: mailboxesFetched } = useMailboxes();
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];
	const isAdmin = configData?.isAdmin === true;
	const {data: approvedLogins = [], refetch: refetchLogins} = useQuery({
		queryKey: ["mq-approved-logins"], queryFn: api.listLogins, enabled: isAdmin,
	});
	const [newLoginEmail, setNewLoginEmail] = useState("");
	const [loginError, setLoginError] = useState<string | null>(null);
	const [loginBusy, setLoginBusy] = useState(false);
	const approveLogin = async (event: FormEvent) => {
		event.preventDefault();
		if (!isAdmin || loginBusy) return;
		setLoginBusy(true); setLoginError(null);
		try { await api.approveLogin(newLoginEmail.trim().toLowerCase()); setNewLoginEmail(""); await refetchLogins(); }
		catch (error) {setLoginError(error instanceof Error ? error.message : "Unable to approve employee");}
		finally {setLoginBusy(false);}
	};
	const toggleLogin = async (email: string, disabled: boolean) => {
		if (!isAdmin || loginBusy) return;
		setLoginBusy(true);setLoginError(null);
		try { if(disabled) await api.restoreLogin(email); else await api.revokeLogin(email); await refetchLogins(); }
		catch(error){setLoginError(error instanceof Error ? error.message : "Could not update access");}
		finally {setLoginBusy(false);}
	};

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPrefix, setNewPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [ownerEmail, setOwnerEmail] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [mailboxToDelete, setMailboxToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	// Auto-create mailboxes from config (run once when both data sources are ready)
	const autoCreateDone = useRef(false);
	useEffect(() => {
		if (autoCreateDone.current) return;
		if (emailAddresses.length === 0 || !mailboxesFetched) return;
		const existingEmails = new Set(
			mailboxes.map((m) => m.email.toLowerCase()),
		);
		const toCreate = emailAddresses.filter(
			(addr) => !existingEmails.has(addr.toLowerCase()),
		);
		if (toCreate.length === 0) {
			autoCreateDone.current = true;
			return;
		}
		autoCreateDone.current = true;
		let cancelled = false;
		Promise.all(
			toCreate.map((addr) => {
				const localPart = addr.split("@")[0] || addr;
				return api.createMailbox(addr, localPart).catch(() => {});
			}),
		).then(() => { if (!cancelled) refetchMailboxes(); });
		return () => { cancelled = true; };
	}, [emailAddresses, mailboxes, refetchMailboxes]);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		if (!isAdmin) return;
		setCreateError(null);
		if (!newPrefix || !selectedDomain) {
			setCreateError("Please fill in all fields");
			return;
		}
		const email = `${newPrefix}@${selectedDomain}`;
		const name = newName || newPrefix;
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name, ownerEmail: ownerEmail.trim() || email });
			toastManager.add({ title: "Mailbox created successfully!" });
			setIsCreateOpen(false);
			setNewPrefix("");
			setNewName("");
			setOwnerEmail("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async () => {
		if (!mailboxToDelete) return;
		setIsDeleting(true);
		try {
			await deleteMailbox.mutateAsync(mailboxToDelete.id);
			toastManager.add({ title: "Mailbox deleted" });
			setIsDeleteOpen(false);
			setMailboxToDelete(null);
		} catch {
			toastManager.add({ title: "Failed to delete mailbox", variant: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const isConfigured = emailAddresses.length > 0;
	// Never display configured-but-uncreated mailboxes as actual employee inboxes.
	const accounts = mailboxes;

	const isLoading = !configData;

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
				<div className="mb-8">
					<div className="mq-identity mb-6"><img src="/favicon.svg" alt="" className="mq-identity-icon" /><div><p className="mq-identity-overline">MAH QUANTUM</p><p className="mq-identity-title">MQ Mailer</p><p className="mq-identity-subtitle">Your secure communications workspace</p></div></div>
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold text-kumo-default">Mailboxes</h1>
						{isAdmin && !isConfigured && (
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								New Mailbox
							</Button>
						)}
					</div>
					{isAdmin && (
						<section className="border border-kumo-line rounded-xl bg-kumo-base p-5 mb-7" aria-label="Employee sign-in management">
							<h2 className="text-lg font-bold text-kumo-default">Employee sign-in access</h2>
							<p className="text-sm text-kumo-subtle my-2">Approve a colleague's Google sign-in email here, then separately assign their email in the mailbox's access settings. Approving login alone grants no mailbox access.</p>
							<form className="flex gap-2 flex-wrap my-3" onSubmit={approveLogin}>
								<input type="email" required aria-label="Employee Google email" placeholder="colleague@gmail.com" value={newLoginEmail} onChange={(e)=>setNewLoginEmail(e.target.value)} className="min-w-52 flex-1 rounded-md border border-kumo-line p-2 bg-kumo-base text-kumo-default" />
								<Button type="submit" variant="primary" loading={loginBusy}>Approve login</Button>
							</form>
							{loginError && <p role="alert" className="text-sm text-red-500 mb-2">{loginError}</p>}
							<ul className="divide-y divide-kumo-line">
								{approvedLogins.map((person) => <li key={person.email} className="flex gap-2 justify-between items-center py-2 flex-wrap">
									<div className="min-w-0"><p className="text-sm font-medium break-all">{person.email}</p><p className="text-xs text-kumo-subtle">{person.disabled ? "Access disabled" : person.bound ? "Google identity bound" : "Awaiting first Google sign-in"}</p></div>
									<Button type="button" size="sm" variant="secondary" disabled={loginBusy} onClick={()=>toggleLogin(person.email,Boolean(person.disabled))}>{person.disabled ? "Restore" : "Revoke"}</Button>
								</li>)}
							</ul>
						</section>
					)}

					{domains.length > 0 && (
						<p className="text-sm text-kumo-subtle mt-1">
							{domains.join(", ")}
						</p>
					)}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : accounts.length > 0 ? (
					<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden">
						{accounts.map((account, idx) => (
							<RouterLink
								key={account.id}
								to={`/mailbox/${account.id}`}
								className={`group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-kumo-tint ${
									idx > 0 ? "border-t border-kumo-line" : ""
								}`}
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-sm font-bold text-kumo-default">
									{account.name.charAt(0).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-kumo-default truncate">
										{account.name}
									</div>
									<div className="text-sm text-kumo-subtle">
										{account.email}
									</div>
								</div>
								{isAdmin && !isConfigured && (
									<Button
										variant="ghost"
										size="sm"
										shape="square"
										icon={<TrashIcon size={16} />}
										aria-label={`Delete mailbox ${account.email}`}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setMailboxToDelete({
												id: account.id,
												email: account.email,
											});
											setIsDeleteOpen(true);
										}}
									/>
								)}
							</RouterLink>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-kumo-line bg-kumo-base py-16 px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								No mailboxes yet
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								{isConfigured
									? "Your email domain is configured but no mailbox has been created."
									: "Create a mailbox for your international email domain. Delivery is enabled separately."}
							</p>
							{isAdmin && !isConfigured && (
								<Button
									variant="primary"
									icon={<PlusIcon size={16} />}
									onClick={() => setIsCreateOpen(true)}
								>
									Create Mailbox
								</Button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-5">
						Create New Mailbox
					</Dialog.Title>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						<div>
							<span className="text-sm font-medium text-kumo-default mb-1.5 block">
								Email Address
							</span>
							<div className="flex items-center gap-2">
								<div className="flex-1">
									<Input
										aria-label="Address prefix"
										placeholder="info"
										size="sm"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										required
									/>
								</div>
								<span className="text-sm text-kumo-subtle">@</span>
								{domains.length > 1 ? (
									<div className="flex-1">
							<Select
								aria-label="Domain"
								value={selectedDomain}
								onValueChange={(value) => {
									if (value) setSelectedDomain(value);
								}}
							>
											{domains.map((d) => (
												<Select.Option key={d} value={d}>
													{d}
												</Select.Option>
											))}
										</Select>
									</div>
								) : (
									<span className="text-sm text-kumo-subtle">
										{selectedDomain || "no domain"}
									</span>
								)}
							</div>
						</div>
						<Input
							label="Owner's approved Google sign-in email (optional)"
							placeholder="employee@example.com — defaults to mailbox address"
							size="sm"
							value={ownerEmail}
							onChange={(e) => setOwnerEmail(e.target.value)}
						/>
						<Input
							label="Display Name (optional)"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										Cancel
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={!selectedDomain}
							>
								Create
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Delete Dialog */}
			<Dialog.Root
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setMailboxToDelete(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Delete Mailbox
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						Are you sure you want to delete{" "}
						<strong className="text-kumo-default">
							{mailboxToDelete?.email}
						</strong>
						? This action cannot be undone.
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button
							variant="destructive"
							size="sm"
							loading={isDeleting}
							onClick={handleDelete}
						>
							Delete
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
