async function test() {
    const fetchAPI = async (body) => {
        const res = await fetch("http://localhost:3000/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        console.log(JSON.stringify(await res.json()));
    };
    console.log("Creating A");
    await fetchAPI({ email: "a@test.com", phoneNumber: "111" });
    console.log("Creating B");
    await fetchAPI({ email: "b@test.com", phoneNumber: "222" });
    console.log("Linking A and B");
    await fetchAPI({ email: "a@test.com", phoneNumber: "222" });
}
test();
