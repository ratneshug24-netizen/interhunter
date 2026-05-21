"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw, Send, SkipForward, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function ProspectDetailPanel({
  prospect,
  onClose,
  onRefresh,
}: {
  prospect: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(prospect.parsedEmail?.subject || "");
  const [body, setBody] = useState(prospect.parsedEmail?.body || "");
  const [isEditing, setIsEditing] = useState(false);

  // Sync state if prospect changes
  useEffect(() => {
    setSubject(prospect.parsedEmail?.subject || "");
    setBody(prospect.parsedEmail?.body || "");
    setIsEditing(false);
  }, [prospect]);

  const founder = prospect.company?.founders?.[0];

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editedEmail: { subject, body },
        }),
      });
      if (!res.ok) throw new Error("Failed to save edits");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setIsEditing(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      // First save edits if any
      if (isEditing) {
        await editMutation.mutateAsync();
      }
      const res = await fetch(`${API_URL}/prospects/${prospect.id}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      onClose(); // Close panel on success
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/prospects/${prospect.id}/skip`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to skip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      onClose();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/prospects/${prospect.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      // Don't close panel, just let it update to PENDING/generating state
      onRefresh();
    },
  });

  const handleSend = () => {
    if (window.confirm(`Are you sure you want to send this email to ${founder?.email}?`)) {
      sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12121a]">
      {/* Header */}
      <div className="p-5 flex justify-between items-center border-b border-[rgba(255,255,255,0.1)]">
        <h2 className="text-xl font-bold truncate pr-4">{prospect.company?.name}</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
          <X size={20} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
        
        {/* Company Details */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Company Profile</h3>
          <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4">
            <p className="text-sm text-gray-300 mb-4">{prospect.company?.description || "No description available."}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 mb-1">Domain</span>
                <a href={prospect.company?.domain.startsWith('http') ? prospect.company.domain : `https://${prospect.company?.domain}`} target="_blank" rel="noopener noreferrer" className="text-[#6c5ce7] hover:underline truncate block">
                  {prospect.company?.domain}
                </a>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Funding</span>
                <span className="text-gray-300">{prospect.company?.fundingStage} ({prospect.company?.fundingAmount || "Undisclosed"})</span>
              </div>
              <div className="col-span-2">
                <span className="block text-gray-500 mb-1">Investors</span>
                <span className="text-gray-300">{prospect.company?.investors?.join(", ") || "Unknown"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Details */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Person</h3>
          <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#6c5ce7] to-[#a855f7] rounded-full flex items-center justify-center text-lg font-bold text-white">
              {founder?.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-bold text-gray-200">{founder?.name || "Unknown"}</div>
              <div className="text-sm text-gray-400">{founder?.title || "Founder"}</div>
              <div className="text-sm text-[#6c5ce7] mt-1">{founder?.email || "No email found"}</div>
            </div>
          </div>
        </section>

        {/* Email Editor */}
        <section className="flex-1 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Generated Email</h3>
            {isEditing ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setSubject(prospect.parsedEmail?.subject || "");
                    setBody(prospect.parsedEmail?.body || "");
                    setIsEditing(false);
                  }}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-600 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => editMutation.mutate()}
                  disabled={editMutation.isPending}
                  className="text-xs bg-[#6c5ce7] hover:bg-[#7c6ef7] text-white px-2 py-1 rounded flex items-center gap-1"
                >
                  <CheckCircle size={14} /> {editMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs text-[#6c5ce7] hover:text-[#7c6ef7] hover:underline"
                disabled={!prospect.parsedEmail}
              >
                Edit Email
              </button>
            )}
          </div>

          {!prospect.parsedEmail ? (
            <div className="flex-1 bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center text-gray-500 flex-col gap-3">
              <RefreshCw className="animate-spin text-[#6c5ce7]" size={24} />
              Generating email...
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-[#16161f] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 flex-1 flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Subject</label>
                {isEditing ? (
                  <input 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#12121a] border border-[rgba(255,255,255,0.2)] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7] mb-4"
                  />
                ) : (
                  <div className="text-sm font-semibold mb-4 text-gray-200">{subject}</div>
                )}

                <label className="text-xs text-gray-500 mb-1">Body</label>
                {isEditing ? (
                  <textarea 
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full flex-1 bg-[#12121a] border border-[rgba(255,255,255,0.2)] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7] resize-none min-h-[250px]"
                  />
                ) : (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap flex-1 overflow-y-auto bg-[#12121a] p-3 rounded border border-[rgba(255,255,255,0.05)]">
                    {body}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

      </div>

      {/* Action Bar */}
      <div className="p-5 border-t border-[rgba(255,255,255,0.1)] bg-[#16161f] flex justify-between items-center gap-3">
        <button 
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending || !prospect.parsedEmail}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#2a2a35] hover:bg-[#3a3a45] text-white transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={regenerateMutation.isPending ? "animate-spin" : ""} />
          Regenerate
        </button>
        
        <div className="flex gap-3">
          <button 
            onClick={() => skipMutation.mutate()}
            disabled={skipMutation.isPending}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-800 text-gray-300 transition disabled:opacity-50"
          >
            <SkipForward size={16} /> Skip
          </button>
          
          <button 
            onClick={handleSend}
            disabled={sendMutation.isPending || !founder?.email || !prospect.parsedEmail}
            className="flex items-center gap-2 text-sm px-6 py-2 rounded-lg bg-gradient-to-r from-[#6c5ce7] to-[#ec4899] hover:from-[#7c6ef7] hover:to-[#f472b6] font-bold text-white shadow-lg transition disabled:opacity-50 disabled:grayscale"
          >
            <Send size={16} /> 
            {sendMutation.isPending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
