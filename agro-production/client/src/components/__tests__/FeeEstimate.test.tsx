import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { FeeEstimate } from "../FeeEstimate";

const PASSPHRASE = StellarSdk.Networks.TESTNET;

// jsdom's crypto shim breaks Keypair.random(); use fixed valid addresses.
const SOURCE = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
const DEST = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

function builtXdr(fee: string) {
  const account = new StellarSdk.Account(SOURCE, "0");
  return new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: PASSPHRASE })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: DEST,
        asset: StellarSdk.Asset.native(),
        amount: "1",
      }),
    )
    .setTimeout(60)
    .build()
    .toXDR();
}

describe("FeeEstimate", () => {
  it("renders nothing before a transaction is built", () => {
    const { container } = render(<FeeEstimate xdr={null} networkPassphrase={PASSPHRASE} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the fee committed to the built transaction", () => {
    render(<FeeEstimate xdr={builtXdr("1000000")} networkPassphrase={PASSPHRASE} />);
    expect(screen.getByTestId("fee-estimate-value")).toHaveTextContent("0.1 XLM");
  });

  it("updates the estimate when conditions change and the tx is rebuilt", () => {
    const { rerender } = render(
      <FeeEstimate xdr={builtXdr("1000000")} networkPassphrase={PASSPHRASE} />,
    );
    expect(screen.getByTestId("fee-estimate-value")).toHaveTextContent("0.1 XLM");

    rerender(<FeeEstimate xdr={builtXdr("5000000")} networkPassphrase={PASSPHRASE} />);
    expect(screen.getByTestId("fee-estimate-value")).toHaveTextContent("0.5 XLM");
  });
});
