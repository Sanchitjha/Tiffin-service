/* =========================================================================
   Super Admin Settings Page
   ========================================================================= */
function pageSaSettings() {
  const s = State.saSettings || { trial_days: 14, monthly_plan_price: 2999, yearly_plan_price: 29999, whatsapp_markup_rate: 0.05 };
  
  return `
    <div class="page-header">
      <div>
        <div class="page-h1">System Settings</div>
        <div class="page-h1-sub">Configure platform variables and credentials</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div class="card-title">SaaS Platform Plans</div></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:12px">
          <div class="field">
            <label class="lbl">Trial Period (days)</label>
            <input id="sa_s_trial" type="number" class="input" value="${s.trial_days || 14}"/>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="lbl">Monthly Fee (INR)</label>
              <input id="sa_s_monthly" type="number" class="input" value="${s.monthly_plan_price || 2999}"/>
            </div>
            <div class="field">
              <label class="lbl">Yearly Fee (INR)</label>
              <input id="sa_s_yearly" type="number" class="input" value="${s.yearly_plan_price || 29999}"/>
            </div>
          </div>
          <div class="field">
            <label class="lbl">WhatsApp Msg Markup Rate (INR)</label>
            <input id="sa_s_markup" type="number" step="0.01" class="input" value="${s.whatsapp_markup_rate || 0.05}"/>
          </div>
          <button class="btn btn-primary" onclick="saveSaSettings()" style="width:fit-content;margin-top:8px">${ic("check", 13)}<span>Save System Settings</span></button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Change Password</div></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:12px">
          <div class="field">
            <label class="lbl">Current Password</label>
            <input id="sa_pw_current" type="password" class="input" placeholder="••••••••"/>
          </div>
          <div class="field">
            <label class="lbl">New Password</label>
            <input id="sa_pw_new" type="password" class="input" placeholder="Min 6 characters"/>
          </div>
          <button class="btn btn-primary" onclick="saveSaPassword()" style="width:fit-content;margin-top:8px">${ic("lock", 13)}<span>Update Password</span></button>
        </div>
      </div>
    </div>
  `;
}

async function saveSaSettings() {
  const trial_days = document.getElementById("sa_s_trial").value;
  const monthly_plan_price = document.getElementById("sa_s_monthly").value;
  const yearly_plan_price = document.getElementById("sa_s_yearly").value;
  const whatsapp_markup_rate = document.getElementById("sa_s_markup").value;

  try {
    await API.superadmin.settings.set({ trial_days, monthly_plan_price, yearly_plan_price, whatsapp_markup_rate });
    UI.toast("System settings updated successfully!", "success");
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}

async function saveSaPassword() {
  const currentPassword = document.getElementById("sa_pw_current").value;
  const newPassword = document.getElementById("sa_pw_new").value;

  if (!currentPassword || !newPassword) {
    UI.toast("Both password fields are required", "error");
    return;
  }

  try {
    await API.auth.changePassword(currentPassword, newPassword);
    UI.toast("Password updated successfully!", "success");
    document.getElementById("sa_pw_current").value = "";
    document.getElementById("sa_pw_new").value = "";
  } catch (err) {
    UI.toast(err.message, "error");
  }
}
